const router = require('express').Router();
const db = require('../../db.core');

function requireTenant(req, res) {
  if (!req.user.tenantId) {
    res.status(400).json({ error: 'Portal do cliente: é preciso logar pelo domínio do tenant (ex.: {tenant}.eventifylab.com)' });
    return null;
  }
  return req.user.tenantId;
}

// GET /api/portal/ativacoes?evento_id= — read-only. Join com eventos garante que o
// evento pedido é do tenant logado antes de devolver qualquer ativação (evita
// vazar ativação de outro tenant só sabendo o id do evento).
router.get('/', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const { evento_id } = req.query;

    let query = db('ativacoes')
      .join('eventos', 'eventos.id', 'ativacoes.evento_id')
      .join('produtos', 'produtos.id', 'ativacoes.produto_id')
      .where('eventos.tenant_id', tenantId);

    if (evento_id) query = query.where('ativacoes.evento_id', evento_id);

    const ativacoes = await query
      .orderBy('ativacoes.created_at', 'desc')
      .select(
        'ativacoes.*',
        'produtos.nome as produto_nome',
        'produtos.slug as produto_slug',
        'produtos.surface as produto_surface'
      );

    res.json({ success: true, ativacoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
