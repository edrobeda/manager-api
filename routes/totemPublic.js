const router = require('express').Router();
const db = require('../db');

const CAMPOS = ['slug', 'lang', 'nome', 'linha', 'descricao_curta', 'descricao', 'imagem_produto_url', 'imagem_banner_url', 'video_url', 'video_local_url', 'url_ficha', 'extras', 'ordem', 'destaque', 'serie'];

// Deriva o tenant a partir do evento vinculado à chave de API usada.
// Chave sem evento_id não tem como identificar o tenant com segurança — bloqueada.
const resolveTenantId = async (req) => {
  if (req.user?.authMethod !== 'basic') return null;

  const key = await db('basic_auth_keys').where({ id: req.user.keyId }).first();
  if (!key?.evento_id) return null;

  const evento = await db('eventos').where({ id: key.evento_id }).first();
  return evento?.tenant_id ?? null;
};

router.get('/produtos', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: 'Chave de API sem evento vinculado' });

    const lang = req.query.lang || 'pt';

    // Busca todas as versões de idioma de uma vez — permite montar a lista no idioma pedido
    // e ainda embutir as traduções de cada produto (pro totem trocar de idioma sem nova chamada de rede)
    const todos = await db('produtos_totem')
      .where({ tenant_id: tenantId, ativo: true })
      .orderBy('ordem', 'asc')
      .select(CAMPOS);

    const porSlug = new Map();
    todos.forEach((p) => {
      if (!porSlug.has(p.slug)) porSlug.set(p.slug, []);
      porSlug.get(p.slug).push(p);
    });

    const produtos = [...porSlug.values()].map((versoes) => {
      const base = versoes.find((v) => v.lang === 'pt') ?? versoes[0];
      const atual = versoes.find((v) => v.lang === lang) ?? base;
      return { ...atual, ordem: base.ordem, idiomas: versoes };
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));

    res.json({ success: true, produtos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Busca por slug — se o idioma pedido não tiver tradução, cai para pt
router.get('/produtos/:slug', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: 'Chave de API sem evento vinculado' });

    const lang = req.query.lang || 'pt';
    const where = { tenant_id: tenantId, ativo: true, slug: req.params.slug };

    let produto = await db('produtos_totem').where({ ...where, lang }).select(CAMPOS).first();
    if (!produto && lang !== 'pt') {
      produto = await db('produtos_totem').where({ ...where, lang: 'pt' }).select(CAMPOS).first();
    }

    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ success: true, produto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configs operacionais do totem (ex: banner_delay) — sem idioma, não são traduzíveis
router.get('/configuracoes', async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(403).json({ error: 'Chave de API sem evento vinculado' });

    const configuracoes = await db('config_totem')
      .where({ tenant_id: tenantId, ativo: true })
      .select('config_slug', 'valor', 'tipo', 'ativo');

    res.json({ success: true, configuracoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
