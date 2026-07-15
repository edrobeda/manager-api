const router = require('express').Router();
const db = require('../db');
const { gerarCodigo } = require('../utils/codigoCurto');

// Gerador genérico de link curto — não é atrelado a produto ou qualquer outra entidade,
// qualquer parte do sistema pode pedir um link curto pra uma URL.
router.post('/', async (req, res) => {
  try {
    const { url_destino, evento_id } = req.body;
    if (!url_destino) return res.status(400).json({ error: 'url_destino é obrigatório' });

    let codigo;
    do {
      codigo = gerarCodigo();
    } while (await db('short_links').where({ codigo }).first());

    await db('short_links').insert({ codigo, url_destino, evento_id: evento_id ?? null });

    res.status(201).json({ success: true, codigo, url_curta: `${req.protocol}://${req.get('host')}/r/${codigo}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
