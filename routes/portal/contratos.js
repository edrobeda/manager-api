const router = require('express').Router();
const db = require('../../db.core');

function requireTenant(req, res) {
  if (!req.user.tenantId) {
    res.status(400).json({ error: 'Portal do cliente: é preciso logar pelo domínio do tenant (ex.: {tenant}.eventifylab.com)' });
    return null;
  }
  return req.user.tenantId;
}

// GET /api/portal/contratos — read-only, join com produtos pra nome/slug de cada
// contrato (tenant_produtos = "o que o tenant contratou").
router.get('/', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const contratos = await db('tenant_produtos')
      .where({ 'tenant_produtos.tenant_id': tenantId })
      .join('produtos', 'produtos.id', 'tenant_produtos.produto_id')
      .orderBy('tenant_produtos.created_at', 'desc')
      .select(
        'tenant_produtos.*',
        'produtos.nome as produto_nome',
        'produtos.slug as produto_slug',
        'produtos.surface as produto_surface'
      );

    res.json({ success: true, contratos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
