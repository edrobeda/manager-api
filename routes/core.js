// Visão do STAFF sobre o core (ROADMAP.md Fase 0/6) — produtos, faturas de
// TODOS os tenants, contratos por tenant. Faltava desde que o core nasceu: o
// Portal do cliente (routes/portal/*) já tem isso, mas sempre escopado a 1
// tenant (req.user.tenantId); aqui é o staff vendo tudo, auth normal (JWT,
// `auth` no index.js) + authorize('superadmin'), mesmo padrão de
// routes/tenants.js.
//
// Resolve tenant por SLUG, nunca por id: `core.tenants` é uma CÓPIA de
// `mydb.tenants` feita uma única vez na Fase 0 (scripts/seed-core-from-mydb.js)
// — os ids podem ter divergido desde então pra qualquer tenant criado depois
// (ver ROADMAP.md §13, "core.users/core.tenants ficaram desatualizados").
// Slug é o identificador estável entre os dois bancos.
const router = require('express').Router();
const authorize = require('../middleware/authorize');
const dbCore = require('../db.core');
const db = require('../db');
const { criarAtivacaoUsoLivre } = require('../services/ativacoes');
const { gerarFaturaParaContrato } = require('../services/faturamento');

// --- produtos (catálogo do core) --------------------------------------------

router.get('/produtos', authorize('superadmin'), async (req, res) => {
  try {
    const produtos = await dbCore('produtos').select('*').orderBy('nome');
    res.json({ success: true, produtos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/produtos', authorize('superadmin'), async (req, res) => {
  try {
    const { slug, nome, surface, dominio, ativo } = req.body;
    if (!slug || !nome) return res.status(400).json({ error: 'slug e nome são obrigatórios' });

    const [produto] = await dbCore('produtos')
      .insert({ slug, nome, surface: surface || null, dominio: dominio || null, ativo: ativo ?? true })
      .returning('*');
    res.json({ success: true, produto });
  } catch (err) {
    if (String(err.message).includes('unique')) return res.status(409).json({ error: `Produto com slug "${req.body.slug}" já existe` });
    res.status(500).json({ error: err.message });
  }
});

router.put('/produtos/:id', authorize('superadmin'), async (req, res) => {
  try {
    const { nome, surface, dominio, ativo } = req.body;
    const campos = {};
    if (nome !== undefined) campos.nome = nome;
    if (surface !== undefined) campos.surface = surface || null;
    if (dominio !== undefined) campos.dominio = dominio || null;
    if (ativo !== undefined) campos.ativo = ativo;

    const [produto] = await dbCore('produtos').where({ id: req.params.id }).update(campos).returning('*');
    if (!produto) return res.status(404).json({ error: 'produto não encontrado' });
    res.json({ success: true, produto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- faturas (cobrança — TODOS os tenants) ----------------------------------

// GET /api/core/faturas?status=&tenant_slug= — join com tenants/produtos pra
// já vir pronto pra tela (nome do tenant, nome do produto), sem N+1 no front.
router.get('/faturas', authorize('superadmin'), async (req, res) => {
  try {
    const { status, tenant_slug: tenantSlug } = req.query;

    let query = dbCore('faturas')
      .join('tenants', 'tenants.id', 'faturas.tenant_id')
      .leftJoin('tenant_produtos', 'tenant_produtos.id', 'faturas.tenant_produto_id')
      .leftJoin('produtos', 'produtos.id', 'tenant_produtos.produto_id')
      .select(
        'faturas.*',
        'tenants.slug as tenant_slug',
        'tenants.nome as tenant_nome',
        'produtos.nome as produto_nome',
        'produtos.slug as produto_slug'
      )
      .orderBy('faturas.vencimento', 'desc');

    if (status) query = query.where('faturas.status', status);
    if (tenantSlug) query = query.where('tenants.slug', tenantSlug);

    const faturas = await query;
    res.json({ success: true, faturas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- contratos por tenant (pra tela de Clientes mostrar o que cada um tem) --

// GET /api/core/tenants/:slug/produtos — contratos (tenant_produtos) do
// tenant identificado por slug (não id — ver comentário no topo do arquivo).
// Tenant sem linha correspondente no core ainda (criado só no mydb, nunca
// sincronizado) devolve lista vazia, não 404 — é um estado válido e comum
// hoje, não um erro.
router.get('/tenants/:slug/produtos', authorize('superadmin'), async (req, res) => {
  try {
    const tenant = await dbCore('tenants').where({ slug: req.params.slug }).first();
    if (!tenant) return res.json({ success: true, tenant_no_core: false, contratos: [] });

    // left join ativacoes (1:1 com o contrato na prática, UNIQUE(evento_id,
    // produto_id) não impede 2 ativações pro mesmo tenant_produto_id em tese,
    // mas hoje a criação só gera 1) pra tela já saber se tem domínio vinculado
    // sem round-trip extra. `dominio` via subquery escalar (não leftJoin) pra
    // não duplicar a linha do contrato quando uma ativação tem mais de 1 alias
    // de domínio — pega só o mais recente.
    const contratos = await dbCore('tenant_produtos')
      .where({ 'tenant_produtos.tenant_id': tenant.id })
      .join('produtos', 'produtos.id', 'tenant_produtos.produto_id')
      .leftJoin('ativacoes', 'ativacoes.tenant_produto_id', 'tenant_produtos.id')
      .leftJoin('eventos', 'eventos.id', 'ativacoes.evento_id')
      .orderBy('tenant_produtos.created_at', 'desc')
      .select(
        'tenant_produtos.*',
        'produtos.nome as produto_nome',
        'produtos.slug as produto_slug',
        'ativacoes.id as ativacao_id',
        'ativacoes.evento_id as evento_id',
        'eventos.nome as evento_nome',
        'eventos.data_inicio as evento_data_inicio',
        'eventos.data_fim as evento_data_fim',
        dbCore('dominios')
          .select('host')
          .whereRaw('dominios.ativacao_id = ativacoes.id')
          .orderBy('created_at', 'desc')
          .limit(1)
          .as('dominio')
      );

    res.json({ success: true, tenant_no_core: true, tenant_id_core: tenant.id, contratos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- sincronizar tenant legado (mydb) pro core -----------------------------

// POST /api/core/tenants/:slug/sincronizar — cria no core (eventifylab) um
// tenant que só existe no `mydb` (criado antes do upsert automático em
// routes/tenants.js existir, ou nunca sincronizado). Idempotente: se já
// existe no core, só devolve ele. Botão "Criar no core agora" no Alert do
// drawer de Produtos contratados (manager-skin) chama isso.
router.post('/tenants/:slug/sincronizar', authorize('superadmin'), async (req, res) => {
  try {
    const legado = await db('tenants').where({ slug: req.params.slug }).first();
    if (!legado) return res.status(404).json({ error: `tenant "${req.params.slug}" não encontrado no mydb` });

    let tenant = await dbCore('tenants').where({ slug: legado.slug }).first();
    if (!tenant) {
      [tenant] = await dbCore('tenants')
        .insert({ slug: legado.slug, nome: legado.nome, logo_url: legado.logo_url, cor_primaria: legado.cor_primaria })
        .returning('*');
    }
    res.json({ success: true, tenant_id_core: tenant.id, tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- eventos do core por tenant (pro formulário de contrato "modo evento") --

router.get('/tenants/:slug/eventos', authorize('superadmin'), async (req, res) => {
  try {
    const tenant = await dbCore('tenants').where({ slug: req.params.slug }).first();
    if (!tenant) return res.json({ success: true, eventos: [] });

    const eventos = await dbCore('eventos').where({ tenant_id: tenant.id }).orderBy('data_inicio', 'desc');
    res.json({ success: true, eventos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- criar contrato (+ ativação) --------------------------------------------

// POST /api/core/tenants/:slug/produtos — cria o contrato (tenant_produtos) e
// a ativação correspondente. `modo` decide se a ativação usa um evento
// existente do tenant ou um evento sintético "sempre ativo" (ver
// services/ativacoes.js). Contrato sozinho sem ativação não serve pra nada
// (nenhum produto teria o que resolver), por isso as duas linhas nascem juntas
// aqui — diferente de /api/ctx/provisionar, que é o produto se
// auto-provisionando (idempotente, reaproveita contrato existente); aqui é o
// staff criando um contrato novo deliberadamente, sempre cria.
router.post('/tenants/:slug/produtos', authorize('superadmin'), async (req, res) => {
  try {
    const {
      produto_id: produtoId, plano, valor_centavos: valorCentavos, ciclo,
      data_fim: dataFim, config, modo, evento_id: eventoId, dominio,
    } = req.body;

    if (!produtoId || !plano || !modo) {
      return res.status(400).json({ error: 'produto_id, plano e modo são obrigatórios' });
    }
    if (!['evento', 'uso_livre'].includes(modo)) {
      return res.status(400).json({ error: 'modo deve ser "evento" ou "uso_livre"' });
    }
    if (modo === 'evento' && !eventoId) {
      return res.status(400).json({ error: 'evento_id é obrigatório quando modo="evento"' });
    }

    const tenant = await dbCore('tenants').where({ slug: req.params.slug }).first();
    if (!tenant) return res.status(404).json({ error: `tenant "${req.params.slug}" não encontrado no core — sincronize primeiro` });

    const produto = await dbCore('produtos').where({ id: produtoId }).first();
    if (!produto) return res.status(404).json({ error: 'produto não encontrado' });

    // Status começa 'trial' (se o plano for trial) ou 'pendente' (plano pago,
    // aguardando o staff confirmar — ver POST /tenant-produtos/:id/confirmar).
    // Nunca nasce 'ativo' direto: confirmar é a ação deliberada que liga o
    // contrato de verdade (e dispara a 1ª cobrança quando for o caso).
    const [tenantProduto] = await dbCore('tenant_produtos')
      .insert({
        tenant_id: tenant.id,
        produto_id: produtoId,
        plano,
        valor_centavos: valorCentavos || 0,
        ciclo: ciclo || 'por_evento',
        status: plano === 'trial' ? 'trial' : 'pendente',
        data_fim: dataFim || null,
        config: config ? JSON.stringify(config) : '{}',
      })
      .returning('*');

    let evento;
    let ativacao;
    if (modo === 'evento') {
      evento = await dbCore('eventos').where({ id: eventoId, tenant_id: tenant.id }).first();
      if (!evento) return res.status(404).json({ error: 'evento não encontrado para este tenant' });

      [ativacao] = await dbCore('ativacoes')
        .insert({ evento_id: evento.id, produto_id: produtoId, tenant_produto_id: tenantProduto.id, status: 'ativo' })
        .returning('*');
    } else {
      // uso_livre: trial sem data_fim explícita ganha +14 dias de janela —
      // é isso que de fato limita o trial (ver services/ativacoes.js e
      // utils/calcStatus.js), não a janela do evento sintético por trás, que
      // fica sempre aberta.
      const dataFimAtivacao = dataFim
        ? new Date(dataFim)
        : (plano === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null);

      ({ evento, ativacao } = await criarAtivacaoUsoLivre(dbCore, {
        tenantId: tenant.id,
        produtoId,
        tenantProdutoId: tenantProduto.id,
        nome: `${produto.nome} — uso livre`,
        dataFimAtivacao,
      }));
    }

    // `dominio` opcional: produto novo (Vitrine/Jogo, sem domínio próprio no
    // cadastro de `produtos`) só responde em produção se alguém registrar um
    // host em `core.dominios` apontando pra essa ativação — sem isso a
    // ativação existe mas não tem URL nenhuma funcionando (achado real,
    // ver ROADMAP.md). Falha ao vincular (ex. host já usado por outra
    // ativação) não derruba o contrato/ativação já criados — fica reportado
    // pro staff resolver manualmente ou tentar outro host.
    let dominioErro = null;
    if (dominio) {
      try {
        await dbCore('dominios').insert({ host: dominio, ativacao_id: ativacao.id });
      } catch (err) {
        dominioErro = String(err.message).includes('unique')
          ? `domínio "${dominio}" já está vinculado a outra ativação`
          : err.message;
      }
    }

    res.json({ success: true, contrato: tenantProduto, evento, ativacao, dominio_erro: dominioErro });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- vincular domínio a uma ativação existente ------------------------------

// POST /api/core/ativacoes/:id/dominio { host } — pra quando o contrato já
// foi criado sem domínio (ou o primeiro host escolhido não servia) e o staff
// quer vincular/trocar depois, sem passar pelo SQL direto.
router.post('/ativacoes/:id/dominio', authorize('superadmin'), async (req, res) => {
  try {
    const { host } = req.body;
    if (!host) return res.status(400).json({ error: 'host é obrigatório' });

    const ativacao = await dbCore('ativacoes').where({ id: req.params.id }).first();
    if (!ativacao) return res.status(404).json({ error: 'ativação não encontrada' });

    const [dominioRow] = await dbCore('dominios').insert({ host, ativacao_id: ativacao.id }).returning('*');
    res.json({ success: true, dominio: dominioRow });
  } catch (err) {
    if (String(err.message).includes('unique')) return res.status(409).json({ error: `domínio "${req.body.host}" já está vinculado a outra ativação` });
    res.status(500).json({ error: err.message });
  }
});

// --- editar período de uma ativação (= "colocar um evento novo") -----------

// PUT /api/core/ativacoes/:id/periodo { data_inicio, data_fim } — até agora só
// o Portal do cliente (routes/portal/eventos.js, escopado a 1 tenant) editava
// datas no core; staff não tinha como trocar a janela de um produto já
// contratado (ex. o próximo evento de um jogo bespoke tipo game-vetnil-pet)
// sem ir direto no banco.
//
// Atualiza a ATIVAÇÃO (ela tem prioridade sobre o evento em
// utils/calcStatus.js: `ativacao.data_fim ?? evento.data_fim`) — é o campo
// que de fato decide `janela_ativa`. Também espelha no evento vinculado,
// EXCETO quando o evento parece ser o "sempre ativo" sintético de uma
// ativação uso_livre (ver services/ativacoes.js, janela de +10 anos) — esse
// nunca deve virar uma janela curta, senão quebra o "sempre ativo".
router.put('/ativacoes/:id/periodo', authorize('superadmin'), async (req, res) => {
  try {
    const { data_inicio: dataInicio, data_fim: dataFim } = req.body;
    if (!dataInicio || !dataFim) return res.status(400).json({ error: 'data_inicio e data_fim são obrigatórios' });

    const ativacao = await dbCore('ativacoes').where({ id: req.params.id }).first();
    if (!ativacao) return res.status(404).json({ error: 'ativação não encontrada' });

    const [atualizada] = await dbCore('ativacoes')
      .where({ id: ativacao.id })
      .update({ data_inicio: dataInicio, data_fim: dataFim })
      .returning('*');

    const CINCO_ANOS_MS = 5 * 365 * 24 * 60 * 60 * 1000;
    const evento = await dbCore('eventos').where({ id: ativacao.evento_id }).first();
    const eventoEhSempreAtivo = evento && (new Date(evento.data_fim) - new Date(evento.data_inicio)) > CINCO_ANOS_MS;
    if (evento && !eventoEhSempreAtivo) {
      await dbCore('eventos').where({ id: evento.id }).update({ data_inicio: dataInicio, data_fim: dataFim });
    }

    res.json({ success: true, ativacao: atualizada, evento_sincronizado: !eventoEhSempreAtivo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- confirmar contrato (ativa + gera 1ª cobrança se não for trial/legado) --

// POST /api/core/tenant-produtos/:id/confirmar — ação explícita de staff:
// marca o contrato como 'ativo' e, se for um plano pago de verdade (não
// trial/legado), gera a 1ª fatura agora e tenta emitir na Asaas. Reaproveita
// services/faturamento.js (mesma lógica do scripts/gerar-faturas.js, só que
// pontual e pra qualquer ciclo, inclusive por_evento).
router.post('/tenant-produtos/:id/confirmar', authorize('superadmin'), async (req, res) => {
  try {
    const contrato = await dbCore('tenant_produtos').where({ id: req.params.id }).first();
    if (!contrato) return res.status(404).json({ error: 'contrato não encontrado' });

    const [atualizado] = await dbCore('tenant_produtos').where({ id: contrato.id }).update({ status: 'ativo' }).returning('*');

    if (['trial', 'legado'].includes(atualizado.plano)) {
      return res.json({ success: true, contrato: atualizado, fatura: null });
    }

    const emitir = !!process.env.ASAAS_API_KEY;
    const { fatura, emissao, erroEmissao } = await gerarFaturaParaContrato(dbCore, atualizado, { emitir });

    res.json({ success: true, contrato: atualizado, fatura, emissao, erroEmissao });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
