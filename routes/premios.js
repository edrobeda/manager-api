const router = require('express').Router();
const authorize = require('../middleware/authorize');
const db = require('../db');

const tenantFilter = (req) =>
  req.user.role === 'superadmin' ? {} : { tenant_id: req.user.tenantId };

router.get('/', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const rows = await db('premios').where(tenantFilter(req)).orderBy('id');
    res.json({ success: true, premios: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { nome, subnome, chance, ativo = true, quantidade } = req.body;
    const tenant_id = req.user.role === 'superadmin' ? req.body.tenant_id : req.user.tenantId;
    const [row] = await db('premios').insert({ nome, subnome, chance, ativo, quantidade, tenant_id }).returning('*');
    res.status(201).json({ success: true, premio: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { nome, subnome, chance, ativo, quantidade } = req.body;
    const [row] = await db('premios').where({ id: req.params.id, ...tenantFilter(req) }).update({ nome, subnome, chance, ativo, quantidade }).returning('*');
    if (!row) return res.status(404).json({ error: 'Prêmio não encontrado' });
    res.json({ success: true, premio: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const deleted = await db('premios').where({ id: req.params.id, ...tenantFilter(req) }).delete();
    if (!deleted) return res.status(404).json({ error: 'Prêmio não encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
