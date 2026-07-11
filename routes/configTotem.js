const router = require('express').Router();
const db = require('../db');

const tenantFilter = (req) =>
  req.user.role === 'superadmin' ? {} : { 'config_totem.tenant_id': req.user.tenantId };

// Lista configs do tenant
router.get('/', async (req, res) => {
  try {
    const configuracoes = await db('config_totem')
      .where(tenantFilter(req))
      .orderBy('config_slug', 'asc')
      .select('*');
    res.json({ success: true, configuracoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cria config
router.post('/', async (req, res) => {
  try {
    const { config_slug, valor, tipo } = req.body;

    if (!config_slug || !valor || !tipo) return res.status(400).json({ error: 'config_slug, valor e tipo são obrigatórios' });

    const tenant_id = req.user.role === 'superadmin'
      ? req.body.tenant_id
      : req.user.tenantId;

    if (!tenant_id) return res.status(400).json({ error: 'tenant_id obrigatório' });

    const [config] = await db('config_totem').insert({
      tenant_id, config_slug, valor, tipo,
    }).returning('*');

    res.status(201).json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edita config
router.put('/:id', async (req, res) => {
  try {
    const where = { id: req.params.id, ...tenantFilter(req) };
    const { valor, tipo, ativo } = req.body;

    const [config] = await db('config_totem').where(where).update({
      valor, tipo, ativo, updated_at: db.fn.now(),
    }).returning('*');

    if (!config) return res.status(404).json({ error: 'Configuração não encontrada' });
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove config (soft delete — ativo=false, conforme padrão do projeto)
router.delete('/:id', async (req, res) => {
  try {
    const where = { id: req.params.id, ...tenantFilter(req) };
    const [config] = await db('config_totem').where(where)
      .update({ ativo: false, updated_at: db.fn.now() })
      .returning('*');
    if (!config) return res.status(404).json({ error: 'Configuração não encontrada' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
