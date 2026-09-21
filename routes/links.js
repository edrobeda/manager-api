const router = require('express').Router();
const authorize = require('../middleware/authorize');
const db = require('../db');
const { obterOuCriarShortLink } = require('../utils/shortLinks');

const PUBLIC_BASE_URL = 'https://eventifylab.com';
const LINKS_PAGE_URL = `${PUBLIC_BASE_URL}/links`;

// link curto + QR fixo + contagens da pagina eventifylab.com/links, por
// tipo de evento: escaneou o QR (link_externo, via GET /r/:codigo),
// visualizou a pagina (pagina_links) e clicou em algum botao (clique_links).
// Precisa vir ANTES de GET /:id, senão "qr-info" seria interpretado como um id.
router.get('/qr-info', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const link = await obterOuCriarShortLink(LINKS_PAGE_URL, null);
    const contagens = await db('acessos')
      .where({ short_link_id: link.id })
      .select('tipo')
      .count('id as total')
      .groupBy('tipo');
    const porTipo = Object.fromEntries(contagens.map((c) => [c.tipo, Number(c.total)]));
    const ultimo = await db('acessos').where({ short_link_id: link.id }).orderBy('criado_em', 'desc').first();

    res.json({
      success: true,
      codigo: link.codigo,
      url: `${PUBLIC_BASE_URL}/r/${link.codigo}`,
      qrSvgUrl: `${PUBLIC_BASE_URL}/r/${link.codigo}/qrcode.svg`,
      qrPngUrl: `${PUBLIC_BASE_URL}/r/${link.codigo}/qrcode.png`,
      totalEscaneamentos: porTipo.link_externo || 0,
      totalVisualizacoes: porTipo.pagina_links || 0,
      totalCliques: porTipo.clique_links || 0,
      ultimoAcessoEm: ultimo ? ultimo.criado_em : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// registro completo de navegacao (visualizacoes + cliques, com sessao_id
// pra reconstruir o percurso de cada visita) — usado pelo modal de
// relatorio/export no painel (ver LinksAnalyticsModal.jsx). referencia de
// cliques e o ID do link (ver routes/linksTrack.js) — resolve pro label
// ATUAL aqui, nao guarda o texto direto no acesso, pra sobreviver a uma
// renomeacao do botao depois.
router.get('/analytics', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const link = await obterOuCriarShortLink(LINKS_PAGE_URL, null);
    const acessos = await db('acessos')
      .where({ short_link_id: link.id })
      .select('id', 'tipo', 'referencia', 'sessao_id', 'criado_em')
      .orderBy('criado_em', 'asc');

    const idsClicados = [...new Set(acessos.filter((a) => a.tipo === 'clique_links').map((a) => a.referencia))];
    const linksClicados = idsClicados.length
      ? await db('tb_links').whereIn('id', idsClicados).select('id', 'label')
      : [];
    const labelPorId = Object.fromEntries(linksClicados.map((l) => [String(l.id), l.label]));

    const acessosComLabel = acessos.map((a) => ({
      ...a,
      referencia_label: a.tipo === 'clique_links'
        ? (labelPorId[a.referencia] || `(link removido #${a.referencia})`)
        : a.referencia,
    }));

    res.json({ success: true, acessos: acessosComLabel });
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

// inclui a contagem de cliques de CADA link (por id, ver routes/linksTrack.js)
// — mostrada como coluna na lista do painel
router.get('/', authorize('superadmin', 'admin', 'viewer'), async (req, res) => {
  try {
    const links = await db('tb_links').select('*').orderBy('position').orderBy('id');
    const cliques = await db('acessos')
      .where({ tipo: 'clique_links' })
      .select('referencia')
      .count('id as total')
      .groupBy('referencia');
    const cliquesPorId = Object.fromEntries(cliques.map((c) => [c.referencia, Number(c.total)]));
    const linksComCliques = links.map((l) => ({ ...l, cliques: cliquesPorId[String(l.id)] || 0 }));
    res.json({ success: true, links: linksComCliques });
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
