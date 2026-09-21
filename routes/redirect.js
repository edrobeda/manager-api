const path = require('path');
const router = require('express').Router();
const db = require('../db');
const { ensureQrFiles } = require('../utils/qr');

// dominio publico fixo (nao o "manager.") — mesmo motivo do Caddyfile
// (eventify.caddy): quem escaneia o QR ou abre o link nunca deve ver o
// dominio interno/privado da equipe.
const PUBLIC_BASE_URL = 'https://eventifylab.com';

// QR code FIXO por link curto — mesmo sistema usado no Salve (src/qr.js):
// gera uma vez, persiste em disco, sempre serve o mesmo arquivo depois
// (Cache-Control immutable). Publicas de proposito, junto do /:codigo
// abaixo — servem pra quem for baixar a imagem pra imprimir, sem precisar
// de sessao.
router.get('/:codigo/qrcode.svg', async (req, res) => {
  try {
    const link = await db('short_links').where({ codigo: req.params.codigo }).first();
    if (!link) return res.status(404).json({ error: 'Link não encontrado' });
    const { svgPath } = await ensureQrFiles(link.codigo, `${PUBLIC_BASE_URL}/r/${link.codigo}`);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path.resolve(svgPath));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:codigo/qrcode.png', async (req, res) => {
  try {
    const link = await db('short_links').where({ codigo: req.params.codigo }).first();
    if (!link) return res.status(404).json({ error: 'Link não encontrado' });
    const { pngPath } = await ensureQrFiles(link.codigo, `${PUBLIC_BASE_URL}/r/${link.codigo}`);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(path.resolve(pngPath));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pública de propósito — precisa funcionar pra quem escaneia o QR code direto do
// celular, sem nenhuma chave de API. Registra o acesso e redireciona pra URL real.
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
