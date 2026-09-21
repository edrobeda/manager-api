const router = require('express').Router();
const authorize = require('../middleware/authorize');
const db = require('../db');

router.get('/', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const links = await db('tb_links').select('*').orderBy('position').orderBy('id');
    res.json({ success: true, links });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const link = await db('tb_links').where({ id: req.params.id }).first();
    if (!link) return res.status(404).json({ success: false, error: 'Link não encontrado' });
    res.json({ success: true, link });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { label, url, icon_url, position, active } = req.body;
    if (!label || !url) return res.status(400).json({ success: false, error: 'Label e URL são obrigatórios' });
    const [link] = await db('tb_links')
      .insert({ label, url, icon_url, position: position || 0, active: active ?? true })
      .returning('*');
    res.status(201).json({ success: true, link });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { label, url, icon_url, position, active } = req.body;
    const link = await db('tb_links').where({ id: req.params.id }).first();
    if (!link) return res.status(404).json({ success: false, error: 'Link não encontrado' });
    const [updated] = await db('tb_links')
      .where({ id: req.params.id })
      .update({ label, url, icon_url, position, active, updated_at: db.fn.now() })
      .returning('*');
    res.json({ success: true, link: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const deleted = await db('tb_links').where({ id: req.params.id }).delete();
    if (!deleted) return res.status(404).json({ success: false, error: 'Link não encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id/active', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const link = await db('tb_links').where({ id: req.params.id }).first();
    if (!link) return res.status(404).json({ success: false, error: 'Link não encontrado' });
    const [updated] = await db('tb_links')
      .where({ id: req.params.id })
      .update({ active: !link.active, updated_at: db.fn.now() })
      .returning('*');
    res.json({ success: true, link: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
