const router = require('express').Router();
const dbCore = require('../db.core');
const { calcStatus } = require('../utils/calcStatus');

// GET /api/ctx/resolve?tenant={slug}&evento={id}&produto={surface}
// Produto resolve o contexto completo de uma requisição num só round-trip
// (cacheável ~60s do lado de quem chama, ver ROADMAP.md §3).
router.get('/resolve', async (req, res) => {
  try {
    const { tenant: tenantSlug, evento: eventoId, produto: produtoSlug } = req.query;
    if (!tenantSlug || !eventoId || !produtoSlug) {
      return res.status(400).json({ error: 'tenant, evento e produto são obrigatórios' });
    }

    const tenant = await dbCore('tenants').where({ slug: tenantSlug }).first();
    if (!tenant) return res.status(404).json({ error: 'tenant não encontrado' });

    const evento = await dbCore('eventos').where({ id: eventoId, tenant_id: tenant.id }).first();
    if (!evento) return res.status(404).json({ error: 'evento não encontrado para este tenant' });

    const produto = await dbCore('produtos').where({ slug: produtoSlug }).first();
    if (!produto) return res.status(404).json({ error: 'produto não encontrado' });

    const ativacaoRow = await dbCore('ativacoes')
      .where({ evento_id: evento.id, produto_id: produto.id })
      .first();

    const ativacao = ativacaoRow ? {
      id: ativacaoRow.id,
      status: calcStatus({
        data_inicio: ativacaoRow.data_inicio ?? evento.data_inicio,
        data_fim: ativacaoRow.data_fim ?? evento.data_fim,
      }),
      data_inicio: ativacaoRow.data_inicio ?? evento.data_inicio,
      data_fim: ativacaoRow.data_fim ?? evento.data_fim,
    } : null;

    let contratoStatus = 'desconhecido';
    if (ativacaoRow?.tenant_produto_id) {
      const tenantProduto = await dbCore('tenant_produtos').where({ id: ativacaoRow.tenant_produto_id }).first();
      contratoStatus = tenantProduto?.status ?? 'desconhecido';
    } else {
      const tenantProduto = await dbCore('tenant_produtos')
        .where({ tenant_id: tenant.id, produto_id: produto.id })
        .first();
      contratoStatus = tenantProduto?.status ?? 'desconhecido';
    }

    res.json({
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      evento: { id: evento.id, nome: evento.nome, status: calcStatus(evento) },
      ativacao,
      produto: { id: produto.id, slug: produto.slug, nome: produto.nome },
      contrato_status: contratoStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ctx/resolve-by-host?host={host}
// Resolve tenant/ativação a partir do domínio público que bateu na request de um
// serviço externo (game-vetnil, game-vetnil-pet) — via X-Forwarded-Host do Caddy, em
// vez de um token/tenant_id fixo no .env de cada deploy. Mesmo shape de resposta de
// POST /api/keys/validate. Ver tabela `dominios` (migrations-core) e ROADMAP.md.
router.get('/resolve-by-host', async (req, res) => {
  try {
    const { host } = req.query;
    if (!host) return res.status(400).json({ error: 'host é obrigatório' });

    const dominio = await dbCore('dominios').where({ host }).first();
    if (!dominio) return res.status(404).json({ error: 'domínio não cadastrado' });

    const ativacao = await dbCore('ativacoes').where({ id: dominio.ativacao_id }).first();
    if (!ativacao) return res.status(404).json({ error: 'ativação não encontrada para este domínio' });

    const evento = await dbCore('eventos').where({ id: ativacao.evento_id }).first();
    const produto = await dbCore('produtos').where({ id: ativacao.produto_id }).first();

    const status = calcStatus({
      data_inicio: ativacao.data_inicio ?? evento?.data_inicio,
      data_fim: ativacao.data_fim ?? evento?.data_fim,
    });

    res.json({
      ativacao_id: ativacao.id,
      evento_id: ativacao.evento_id,
      produto: produto?.slug ?? null,
      tenant_id: evento?.tenant_id ?? null,
      janela_ativa: status === 'ativo',
      // status completo (agendado/ativo/expirando/encerrado) — quem chama decide se
      // trata "expirando" como ativo ou não (game-vetnil/game-vetnil-pet tratam como
      // ativo, pra manter o mesmo comportamento de antes desta migração).
      status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ctx/provisionar { tenant_slug, tenant_nome, produto_slug, evento_nome,
//   data_inicio?, data_fim? }
// Fase 5 do ROADMAP.md — endpoint de serviço (service token, não JWT humano) que
// falta pra um produto conseguir se auto-provisionar no core (hoje só existe
// criação de tenant/evento via /api/tenants e /api/portal/eventos, ambos atrás de
// `auth` humano). Primeiro consumidor é o `salve` (signup próprio: empresa raiz =
// tenant, evento filho de parceiro = evento), mas serve qualquer produto com
// cadastro aberto (ex. o produto "interactive" planejado no §14).
// Idempotente por slug: tenant com aquele slug já existente é reaproveitado (nunca
// duplicado) — é assim que uma empresa raiz de parceiro ganha vários eventos no
// mesmo tenant, cada evento filho chamando de novo com o MESMO tenant_slug.
// `evento_nome` sempre cria um evento NOVO (quem chama decide a idempotência disso
// do lado dele, guardando o `evento_id_core` recebido — ver `src/core.js` do salve).
// `data_inicio`/`data_fim` são opcionais porque nem todo produto tem data de evento
// (ex. salve: um "evento" ali é uma página que fica no ar indefinidamente, sem data
// fixa) — sem elas, usa a janela "sempre ativo" (agora até +10 anos), já que a
// coluna é NOT NULL no schema do core e não vale a pena relaxar isso por um só
// consumidor (ver ROADMAP.md, princípio de expand-and-contract).
router.post('/provisionar', async (req, res) => {
  try {
    const { tenant_slug: tenantSlug, tenant_nome: tenantNome, produto_slug: produtoSlug, evento_nome: eventoNome } = req.body;
    if (!tenantSlug || !tenantNome || !produtoSlug || !eventoNome) {
      return res.status(400).json({ error: 'tenant_slug, tenant_nome, produto_slug e evento_nome são obrigatórios' });
    }

    const produto = await dbCore('produtos').where({ slug: produtoSlug }).first();
    if (!produto) return res.status(404).json({ error: `produto '${produtoSlug}' não cadastrado no core` });

    let tenant = await dbCore('tenants').where({ slug: tenantSlug }).first();
    if (!tenant) {
      [tenant] = await dbCore('tenants').insert({ slug: tenantSlug, nome: tenantNome }).returning('*');
    }

    let tenantProduto = await dbCore('tenant_produtos').where({ tenant_id: tenant.id, produto_id: produto.id }).first();
    if (!tenantProduto) {
      [tenantProduto] = await dbCore('tenant_produtos')
        .insert({ tenant_id: tenant.id, produto_id: produto.id, plano: 'trial', status: 'ativo', ciclo: 'por_evento' })
        .returning('*');
    }

    const agora = new Date();
    const dataInicio = req.body.data_inicio ?? agora.toISOString();
    const dataFim = req.body.data_fim ?? new Date(agora.getFullYear() + 10, agora.getMonth(), agora.getDate()).toISOString();

    const [evento] = await dbCore('eventos')
      .insert({ tenant_id: tenant.id, nome: eventoNome, data_inicio: dataInicio, data_fim: dataFim, origem: 'cliente', status: 'ativo' })
      .returning('*');

    const [ativacao] = await dbCore('ativacoes')
      .insert({ evento_id: evento.id, produto_id: produto.id, tenant_produto_id: tenantProduto.id, status: 'ativo' })
      .returning('*');

    res.json({ tenant_id: tenant.id, evento_id: evento.id, ativacao_id: ativacao.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
