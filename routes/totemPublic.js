const router = require('express').Router();
const db = require('../db');
const { obterOuCriarShortLink } = require('../utils/shortLinks');

const CAMPOS = ['slug', 'lang', 'nome', 'linha', 'descricao_curta', 'descricao', 'imagem_produto_url', 'imagem_banner_url', 'video_url', 'video_local_url', 'url_ficha', 'extras', 'ordem', 'destaque', 'serie', 'banner_institucional'];

// Deriva o tenant e o evento a partir da chave de API usada.
// Chave sem evento_id não tem como identificar o tenant com segurança — bloqueada.
const resolveContexto = async (req) => {
  if (req.user?.authMethod !== 'basic') return null;

  const key = await db('basic_auth_keys').where({ id: req.user.keyId }).first();
  if (!key?.evento_id) return null;

  const evento = await db('eventos').where({ id: key.evento_id }).first();
  if (!evento?.tenant_id) return null;

  return { tenantId: evento.tenant_id, eventoId: key.evento_id };
};

// Atrás do proxy de produção req.protocol sempre vem 'http' — usa o header de encaminhamento quando existir
function baseUrlDe(req) {
  const protocolo = req.headers['x-forwarded-proto']?.split(',')[0] || req.protocol;
  return `${protocolo}://${req.get('host')}`;
}

// Troca a URL direta da ficha por um link curto nosso — assim dá pra saber se
// alguém de fato escaneou o QR code (URL direta nunca passa pelo servidor).
// Reaproveita o mesmo link pra cada produto/idioma, então o QR não fica mudando de código.
async function comLinkCurtoDeFicha(linhas, eventoId, baseUrl) {
  for (const linha of linhas) {
    if (!linha.url_ficha) continue;
    const link = await obterOuCriarShortLink(linha.url_ficha, eventoId);
    linha.url_ficha = `${baseUrl}/r/${link.codigo}`;
  }
  return linhas;
}

router.get('/produtos', async (req, res) => {
  try {
    const contexto = await resolveContexto(req);
    if (!contexto) return res.status(403).json({ error: 'Chave de API sem evento vinculado' });
    const { tenantId, eventoId } = contexto;

    const lang = req.query.lang || 'pt';

    // Busca todas as versões de idioma de uma vez — permite montar a lista no idioma pedido
    // e ainda embutir as traduções de cada produto (pro totem trocar de idioma sem nova chamada de rede)
    // banner_institucional entra mesmo com ativo=false — é um item só de banner, não um produto real
    const todos = await db('produtos_totem')
      .where({ tenant_id: tenantId })
      .andWhere((qb) => qb.where('ativo', true).orWhere('banner_institucional', true))
      .orderBy('ordem', 'asc')
      .select(CAMPOS);

    const baseUrl = baseUrlDe(req);
    await comLinkCurtoDeFicha(todos, eventoId, baseUrl);

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
    const contexto = await resolveContexto(req);
    if (!contexto) return res.status(403).json({ error: 'Chave de API sem evento vinculado' });
    const { tenantId, eventoId } = contexto;

    const lang = req.query.lang || 'pt';
    const where = { tenant_id: tenantId, slug: req.params.slug };
    const ativoOuBanner = (qb) => qb.where('ativo', true).orWhere('banner_institucional', true);

    let produto = await db('produtos_totem').where({ ...where, lang }).andWhere(ativoOuBanner).select(CAMPOS).first();
    if (!produto && lang !== 'pt') {
      produto = await db('produtos_totem').where({ ...where, lang: 'pt' }).andWhere(ativoOuBanner).select(CAMPOS).first();
    }

    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const baseUrl = baseUrlDe(req);
    await comLinkCurtoDeFicha([produto], eventoId, baseUrl);

    res.json({ success: true, produto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Configs operacionais do totem (ex: banner_delay) — sem idioma, não são traduzíveis
router.get('/configuracoes', async (req, res) => {
  try {
    const contexto = await resolveContexto(req);
    if (!contexto) return res.status(403).json({ error: 'Chave de API sem evento vinculado' });

    const configuracoes = await db('config_totem')
      .where({ tenant_id: contexto.tenantId, ativo: true })
      .select('config_slug', 'valor', 'tipo', 'ativo');

    res.json({ success: true, configuracoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/totem/estatisticas — base pra página /statistic do totem: devolve os
// acessos crus dos últimos N dias já com o produto resolvido (quando aplicável),
// pra agregação por dia/produto ficar por conta de quem consome (a própria tela).
router.get('/estatisticas', async (req, res) => {
  try {
    const contexto = await resolveContexto(req);
    if (!contexto) return res.status(403).json({ error: 'Chave de API sem evento vinculado' });
    const { tenantId, eventoId } = contexto;

    const dias = Math.min(parseInt(req.query.dias) || 30, 90);
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const acessos = await db('acessos')
      .leftJoin('short_links', 'short_links.id', 'acessos.short_link_id')
      .where('acessos.evento_id', eventoId)
      .andWhere('acessos.criado_em', '>=', desde)
      .select('acessos.tipo', 'acessos.referencia', 'acessos.criado_em', 'short_links.url_destino')
      .orderBy('acessos.criado_em', 'desc');

    const produtos = await db('produtos_totem')
      .where({ tenant_id: tenantId })
      .select('slug', 'nome', 'url_ficha');
    const porUrlFicha = new Map(produtos.filter((p) => p.url_ficha).map((p) => [p.url_ficha, p]));
    const porSlug = new Map(produtos.map((p) => [p.slug, p]));

    // Resolve o produto de cada acesso conforme o tipo: 'pagina' extrai o slug da
    // rota, 'video' já vem com o slug como referência, 'link_externo' precisa
    // casar a url_destino do link curto com a ficha do produto.
    const eventos = acessos.map((a) => {
      let slug = null;
      let nome = null;
      if (a.tipo === 'pagina') {
        const match = a.referencia.match(/^\/produto\/(.+)$/);
        if (match) {
          slug = match[1];
          nome = porSlug.get(slug)?.nome ?? null;
        }
      } else if (a.tipo === 'video') {
        slug = a.referencia;
        nome = porSlug.get(slug)?.nome ?? null;
      } else if (a.tipo === 'link_externo' && a.url_destino) {
        const produto = porUrlFicha.get(a.url_destino);
        if (produto) { slug = produto.slug; nome = produto.nome; }
      }
      return { tipo: a.tipo, slug, nome, criadoEm: a.criado_em };
    });

    res.json({ success: true, eventos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
