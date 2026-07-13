const router = require('express').Router();
const db = require('../db');

// Pública de propósito — precisa funcionar pra quem escaneia o QR code direto do celular,
// sem nenhuma chave de API. Registra o acesso e redireciona pra URL real.
router.get('/:codigo', async (req, res) => {
  try {
    const link = await db('short_links').where({ codigo: req.params.codigo }).first();
    if (!link) return res.status(404).json({ error: 'Link não encontrado' });

    await db('acessos').insert({
      evento_id: link.evento_id,
      tipo: 'link_externo',
      referencia: link.codigo,
      short_link_id: link.id,
    });

    res.redirect(302, link.url_destino);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
