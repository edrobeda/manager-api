const router = require('express').Router();
const db = require('../db');

const CAMPOS = ['slug', 'lang', 'nome', 'linha', 'descricao_curta', 'descricao', 'imagem_produto_url', 'imagem_banner_url', 'video_url', 'extras', 'ordem'];

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

    // Base sempre em pt (catálogo completo) — quando existir tradução no idioma pedido, ela substitui a linha pt
    const base = await db('produtos_totem')
      .where({ tenant_id: tenantId, ativo: true, lang: 'pt' })
      .orderBy('ordem', 'asc')
      .select(CAMPOS);

    let produtos = base;
    if (lang !== 'pt') {
      const traduzidos = await db('produtos_totem')
        .where({ tenant_id: tenantId, ativo: true, lang })
        .select(CAMPOS);
      const porSlug = Object.fromEntries(traduzidos.map((p) => [p.slug, p]));
      produtos = base.map((p) => ({ ...(porSlug[p.slug] ?? p), ordem: p.ordem }));
    }

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

module.exports = router;
