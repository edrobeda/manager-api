const router = require('express').Router();
const db = require('../db');
const { obterOuCriarShortLink } = require('../utils/shortLinks');

const LINKS_PAGE_URL = 'https://eventifylab.com/links';

// Publico, sem chave de API — quem ve eventifylab.com/links e um visitante
// anonimo, sem sessao de admin nenhuma. tipo 'pagina' = carregou a pagina;
// 'clique' = apertou um botao (referencia = id do link em tb_links, NAO o
// label — assim sobrevive a um link ser renomeado depois, ver GET
// /api/links/analytics que resolve o label na hora de montar o relatorio).
// sessao_id (gerado no navegador) agrupa os eventos da MESMA visita.
router.post('/', async (req, res) => {
  try {
    const { tipo, referencia, sessao_id } = req.body || {};
    if (tipo !== 'pagina' && tipo !== 'clique') {
      return res.status(400).json({ error: 'tipo precisa ser "pagina" ou "clique"' });
    }
    if (!sessao_id) return res.status(400).json({ error: 'sessao_id é obrigatório' });

    const link = await obterOuCriarShortLink(LINKS_PAGE_URL, null);
    await db('acessos').insert({
      evento_id: null,
      tipo: tipo === 'pagina' ? 'pagina_links' : 'clique_links',
      referencia: String(referencia || 'view').slice(0, 500),
      short_link_id: link.id,
      sessao_id: String(sessao_id).slice(0, 64),
    });

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
