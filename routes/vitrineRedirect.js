// Espelha routes/redirect.js contra o banco vitrine — pública de propósito (quem
// escaneia o QR code não tem chave de API). Path próprio (/r-vitrine) pra não colidir
// com /r/:codigo, que continua servindo os links curtos antigos em mydb.
const router = require('express').Router();
const dbVitrine = require('../db.vitrine');

router.get('/:codigo', async (req, res) => {
  try {
    const link = await dbVitrine('short_links').where({ codigo: req.params.codigo }).first();
    if (!link) return res.status(404).json({ error: 'Link não encontrado' });

    await dbVitrine('acessos').insert({
      ativacao_id: link.ativacao_id,
      tenant_id: link.tenant_id,
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
