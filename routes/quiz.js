const router = require('express').Router();
const authorize = require('../middleware/authorize');
const db = require('../db');

const tenantFilter = (req) =>
  req.user.role === 'superadmin' ? {} : { tenant_id: req.user.tenantId };

router.get('/', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const rows = await db('quiz').where(tenantFilter(req)).orderBy('id');
    res.json({ success: true, quiz: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const row = await db('quiz').where({ id: req.params.id, ...tenantFilter(req) }).first();
    if (!row) return res.status(404).json({ error: 'Questão não encontrada' });
    res.json({ success: true, quiz: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { pergunta, primeira, segunda, terceira, quarta, correta, ativo = true } = req.body;
    const tenant_id = req.user.role === 'superadmin' ? req.body.tenant_id : req.user.tenantId;
    const [row] = await db('quiz').insert({ pergunta, primeira, segunda, terceira, quarta, correta, ativo, tenant_id }).returning('*');
    res.status(201).json({ success: true, quiz: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { pergunta, primeira, segunda, terceira, quarta, correta, ativo } = req.body;
    const [row] = await db('quiz').where({ id: req.params.id, ...tenantFilter(req) }).update({ pergunta, primeira, segunda, terceira, quarta, correta, ativo }).returning('*');
    if (!row) return res.status(404).json({ error: 'Questão não encontrada' });
    res.json({ success: true, quiz: row });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const deleted = await db('quiz').where({ id: req.params.id, ...tenantFilter(req) }).delete();
    if (!deleted) return res.status(404).json({ error: 'Questão não encontrada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
