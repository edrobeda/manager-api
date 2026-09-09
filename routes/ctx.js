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

module.exports = router;
