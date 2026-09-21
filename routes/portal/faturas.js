const router = require('express').Router();
const db = require('../../db.core');

function requireTenant(req, res) {
  if (!req.user.tenantId) {
    res.status(400).json({ error: 'Portal do cliente: é preciso logar pelo domínio do tenant (ex.: {tenant}.eventifylab.com)' });
    return null;
  }
  return req.user.tenantId;
}

// GET /api/portal/faturas — read-only, filtro opcional status/competencia
router.get('/', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const { status, competencia } = req.query;

    let query = db('faturas').where({ tenant_id: tenantId });
    if (status) query = query.where({ status });
    if (competencia) query = query.where({ competencia });

    const faturas = await query.orderBy('vencimento', 'desc').select('*');

    res.json({ success: true, faturas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
