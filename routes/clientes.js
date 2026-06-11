const router = require('express').Router();
const authorize = require('../middleware/authorize');
const db = require('../db');

const tenantFilter = (req) =>
  req.user.role === 'superadmin' ? {} : { tenant_id: req.user.tenantId };

router.get('/', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const rows = await db('clientes').where(tenantFilter(req)).orderBy('criado_em', 'desc');
    res.json({ success: true, clientes: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { nome, cpf, email, perfil, telefone } = req.body;
    const tenant_id = req.user.role === 'superadmin' ? req.body.tenant_id : req.user.tenantId;
    const [row] = await db('clientes').insert({ nome, cpf, email, perfil, telefone, tenant_id }).returning('*');
    res.status(201).json({ success: true, cliente: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const deleted = await db('clientes').where({ id: req.params.id, ...tenantFilter(req) }).delete();
    if (!deleted) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
