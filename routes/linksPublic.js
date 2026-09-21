const router = require('express').Router();
const db = require('../db');

// GET /api/links-public — lista só os links ativos, ordenados — consumido
// pela pagina estatica eventifylab.com/links (fetch client-side, CORS já
// liberado globalmente em index.js). Público de propósito, mesmo espírito
// de /api/estados e /api/cidades (routes/localizacao.js): dado de
// referência sem tenant, sem chave de API.
router.get('/', async (req, res) => {
  try {
    const links = await db('tb_links')
      .select('id', 'label', 'url', 'icon_url')
      .where({ active: true })
      .orderBy('position')
      .orderBy('id');
    res.json({ success: true, links });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
