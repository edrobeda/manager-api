const router = require('express').Router();
const authorize = require('../middleware/authorize');
const db = require('../db');

const tenantFilter = (req) =>
  req.user.role === 'superadmin' ? {} : { tenant_id: req.user.tenantId };

router.get('/', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const rows = await db('partidas')
      .where(tenantFilter(req))
      .join('clientes', 'partidas.cliente_id', 'clientes.id')
      .leftJoin('premios', 'partidas.premio_id', 'premios.id')
      .select(
        'partidas.*',
        'clientes.nome as cliente_nome',
        'clientes.email as cliente_email',
        'premios.nome as premio_nome'
      )
      .orderBy('partidas.jogado_em', 'desc');
    res.json({ success: true, partidas: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
