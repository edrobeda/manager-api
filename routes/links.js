const router = require('express').Router();
const authorize = require('../middleware/authorize');
const db = require('../db');
const { obterOuCriarShortLink } = require('../utils/shortLinks');

const PUBLIC_BASE_URL = 'https://eventifylab.com';
const LINKS_PAGE_URL = `${PUBLIC_BASE_URL}/links`;

// link curto + QR fixo + contagem de escaneamentos da pagina eventifylab.com/links
// (não de cada botão individual — é a página inteira que é divulgada por QR).
// Precisa vir ANTES de GET /:id, senão "qr-info" seria interpretado como um id.
router.get('/qr-info', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const link = await obterOuCriarShortLink(LINKS_PAGE_URL, null);
    const totalRow = await db('acessos').where({ short_link_id: link.id }).count('id as total').first();
    const ultimo = await db('acessos').where({ short_link_id: link.id }).orderBy('criado_em', 'desc').first();

    res.json({
      success: true,
      codigo: link.codigo,
      url: `${PUBLIC_BASE_URL}/r/${link.codigo}`,
      qrSvgUrl: `${PUBLIC_BASE_URL}/r/${link.codigo}/qrcode.svg`,
      qrPngUrl: `${PUBLIC_BASE_URL}/r/${link.codigo}/qrcode.png`,
      totalEscaneamentos: Number(totalRow.total),
      ultimoEscaneamentoEm: ultimo ? ultimo.criado_em : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// reordena via lista de ids na ordem desejada (drag-and-drop no painel,
// ver pages/Links/index.jsx) — "position" de cada link vira o INDICE dele
// nessa lista, nunca digitado a mao. Precisa vir ANTES de GET/PUT /:id.
router.post('/reorder', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (ids.length === 0) return res.status(400).json({ success: false, error: 'ids é obrigatório' });

    await db.transaction(async (trx) => {
      for (let i = 0; i < ids.length; i++) {
        await trx('tb_links').where({ id: ids[i] }).update({ position: i, updated_at: trx.fn.now() });
      }
    });

    const links = await db('tb_links').select('*').orderBy('position').orderBy('id');
    res.json({ success: true, links });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// posicao sempre automatica (vai pro fim da lista) — nunca vem do corpo da
// requisicao, reordenar e so via drag-and-drop (POST /reorder acima)
router.post('/', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { label, url, icon_url, active } = req.body;
    if (!label || !url) return res.status(400).json({ success: false, error: 'Label e URL são obrigatórios' });
    const maxRow = await db('tb_links').max('position as max').first();
    const nextPosition = (maxRow.max ?? -1) + 1;
    const [link] = await db('tb_links')
      .insert({ label, url, icon_url, position: nextPosition, active: active ?? true })
      .returning('*');
    res.status(201).json({ success: true, link });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// nunca mexe em "position" aqui — edicao de conteudo e reordenar sao acoes
// separadas de proposito (edicao nao deve "sequestrar" o lugar do link sem
// querer)
router.put('/:id', authorize('superadmin', 'admin'), async (req, res) => {
  try {
    const { label, url, icon_url, active } = req.body;
    const link = await db('tb_links').where({ id: req.params.id }).first();
    if (!link) return res.status(404).json({ success: false, error: 'Link não encontrado' });
    const [updated] = await db('tb_links')
      .where({ id: req.params.id })
      .update({ label, url, icon_url, active, updated_at: db.fn.now() })
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
