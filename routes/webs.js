const router = require('express').Router();
const authorize = require('../middleware/authorize');
const db = require('../db');

router.get('/', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const webs = await db('tb_webs').select('*').orderBy('name');
    res.json({ success: true, webs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const web = await db('tb_webs').where({ id: req.params.id }).first();
    if (!web) return res.status(404).json({ success: false, error: 'Web não encontrada' });
    res.json({ success: true, web });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, url, description, favorite } = req.body;
    if (!name || !url) return res.status(400).json({ success: false, error: 'Nome e URL são obrigatórios' });
    const [web] = await db('tb_webs').insert({ name, url, description, favorite }).returning('*');
    res.status(201).json({ success: true, web });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { name, url, description, favorite } = req.body;
    const web = await db('tb_webs').where({ id: req.params.id }).first();
    if (!web) return res.status(404).json({ success: false, error: 'Web não encontrada' });
    const [updated] = await db('tb_webs').where({ id: req.params.id }).update({ name, url, description, favorite, updated_at: db.fn.now() }).returning('*');
    res.json({ success: true, web: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const deleted = await db('tb_webs').where({ id: req.params.id }).delete();
    if (!deleted) return res.status(404).json({ success: false, error: 'Web não encontrada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/favorite', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const web = await db('tb_webs').where({ id: req.params.id }).first();
    if (!web) return res.status(404).json({ success: false, error: 'Web não encontrada' });
    const [updated] = await db('tb_webs').where({ id: req.params.id }).update({ favorite: !web.favorite, updated_at: db.fn.now() }).returning('*');
    res.json({ success: true, web: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/migrate', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { webs } = req.body;
    if (!Array.isArray(webs) || !webs.length) return res.status(400).json({ success: false, error: 'Array de webs é obrigatório' });
    await db('tb_webs').insert(webs.map(w => ({ name: w.name, url: w.url, description: w.description || null, favorite: w.favorite || false })));
    res.status(201).json({ success: true, message: `${webs.length} página(s) migrada(s)` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
