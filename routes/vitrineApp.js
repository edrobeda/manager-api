// Fase 2 do ROADMAP.md — backend multitenant do app Vitrine, lendo do banco `vitrine`
// (não `mydb`) e resolvendo contexto via `req.ativacao` (middleware/vitrineDeviceAuth.js,
// que já checou produto==='vitrine' e tenant_id resolvido pelo core). Espelha a lógica
// de routes/totemPublic.js — mesmo comportamento, fonte de dados nova. Rotas legadas do
// totem_vetnil (routes/totemPublic.js contra mydb) continuam intocadas e no ar.
const router = require('express').Router();
const dbVitrine = require('../db.vitrine');
const { obterOuCriarShortLinkVitrine } = require('../utils/vitrineShortLinks');

const CAMPOS = ['slug', 'lang', 'nome', 'linha', 'descricao_curta', 'descricao', 'imagem_produto_url', 'imagem_banner_url', 'video_url', 'video_local_url', 'url_ficha', 'extras', 'ordem', 'destaque', 'serie', 'banner_institucional'];

const OFFSET_BRASILIA = '-03:00';

function parseJanelaAnalitica(valor) {
  const m = String(valor).trim().match(
    /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
  );
  if (!m) return null;
  const [, d1, mo1, y1, h1, mi1, s1, d2, mo2, y2, h2, mi2, s2] = m;
  const inicio = new Date(`${y1}-${mo1}-${d1}T${h1}:${mi1}:${s1}${OFFSET_BRASILIA}`);
  const fim = new Date(`${y2}-${mo2}-${d2}T${h2}:${mi2}:${s2}${OFFSET_BRASILIA}`);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return null;
  return { inicio, fim };
}

function baseUrlDe(req) {
  const protocolo = req.headers['x-forwarded-proto']?.split(',')[0] || req.protocol;
  return `${protocolo}://${req.get('host')}`;
}

async function comLinkCurtoDeFicha(linhas, ativacaoId, tenantId, baseUrl) {
  for (const linha of linhas) {
    if (!linha.url_ficha) continue;
    const link = await obterOuCriarShortLinkVitrine(linha.url_ficha, ativacaoId, tenantId);
    linha.url_ficha = `${baseUrl}/r-vitrine/${link.codigo}`;
  }
  return linhas;
}

router.get('/produtos', async (req, res) => {
  try {
    const { tenant_id: tenantId, ativacao_id: ativacaoId } = req.ativacao;
    const lang = req.query.lang || 'pt';

    const todos = await dbVitrine('produtos_totem')
      .where({ tenant_id: tenantId })
      .andWhere((qb) => qb.where('ativo', true).orWhere('banner_institucional', true))
      .orderBy('ordem', 'asc')
      .select(CAMPOS);

    const baseUrl = baseUrlDe(req);
    await comLinkCurtoDeFicha(todos, ativacaoId, tenantId, baseUrl);

    const porSlug = new Map();
    todos.forEach((p) => {
      if (!porSlug.has(p.slug)) porSlug.set(p.slug, []);
      porSlug.get(p.slug).push(p);
    });

    const produtos = [...porSlug.values()].map((versoes) => {
      const base = versoes.find((v) => v.lang === 'pt') ?? versoes[0];
      const atual = versoes.find((v) => v.lang === lang) ?? base;
      return { ...atual, ordem: base.ordem, idiomas: versoes };
    });

    res.json({ success: true, produtos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/produtos/:slug', async (req, res) => {
  try {
    const { tenant_id: tenantId, ativacao_id: ativacaoId } = req.ativacao;
    const lang = req.query.lang || 'pt';
    const where = { tenant_id: tenantId, ativo: true, slug: req.params.slug };

    let produto = await dbVitrine('produtos_totem').where({ ...where, lang }).select(CAMPOS).first();
    if (!produto && lang !== 'pt') {
      produto = await dbVitrine('produtos_totem').where({ ...where, lang: 'pt' }).select(CAMPOS).first();
    }

    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });

    const baseUrl = baseUrlDe(req);
    await comLinkCurtoDeFicha([produto], ativacaoId, tenantId, baseUrl);

    res.json({ success: true, produto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/configuracoes', async (req, res) => {
  try {
    const { tenant_id: tenantId } = req.ativacao;
    const configuracoes = await dbVitrine('config_totem')
      .where({ tenant_id: tenantId, ativo: true })
      .select('config_slug', 'valor', 'tipo', 'ativo');

    res.json({ success: true, configuracoes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/estatisticas', async (req, res) => {
  try {
    const { tenant_id: tenantId, ativacao_id: ativacaoId } = req.ativacao;

    const dias = Math.min(parseInt(req.query.dias) || 30, 90);
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const configsJanela = await dbVitrine('config_totem')
      .where({ tenant_id: tenantId, config_slug: 'data_analiticas', ativo: true })
      .select('valor');
    const janelas = configsJanela
      .map((c) => parseJanelaAnalitica(c.valor))
      .filter(Boolean);

    // Quando existe janela configurada (data_analiticas), ela é a única regra de data —
    // não soma com o corte de "dias", senão um evento configurado fora do período
    // selecionado some da tela mesmo estando dentro da janela que o admin definiu.
    const acessos = await dbVitrine('acessos')
      .leftJoin('short_links', 'short_links.id', 'acessos.short_link_id')
      .where('acessos.ativacao_id', ativacaoId)
      .modify((qb) => {
        if (janelas.length === 0) {
          qb.andWhere('acessos.criado_em', '>=', desde);
          return;
        }
        qb.andWhere((sub) => {
          janelas.forEach(({ inicio, fim }) => sub.orWhereBetween('acessos.criado_em', [inicio, fim]));
        });
      })
      .select('acessos.tipo', 'acessos.referencia', 'acessos.criado_em', 'acessos.duracao_segundos', 'acessos.totem_id', 'short_links.url_destino')
      .orderBy('acessos.criado_em', 'desc');

    const produtos = await dbVitrine('produtos_totem')
      .where({ tenant_id: tenantId })
      .select('slug', 'nome', 'url_ficha');
    const porUrlFicha = new Map(produtos.filter((p) => p.url_ficha).map((p) => [p.url_ficha, p]));
    const porSlug = new Map(produtos.map((p) => [p.slug, p]));

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
      return { tipo: a.tipo, slug, nome, criadoEm: a.criado_em, duracaoSegundos: a.duracao_segundos, totemId: a.totem_id };
    });

    res.json({ success: true, eventos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/acessos', async (req, res) => {
  try {
    const { tenant_id: tenantId, ativacao_id: ativacaoId } = req.ativacao;
    const { path, tipo, referencia, duracao_segundos, totem_id } = req.body;
    const tipoFinal = tipo || 'pagina';
    const referenciaFinal = referencia ?? path;
    if (!referenciaFinal) return res.status(400).json({ error: 'path ou referencia é obrigatório' });

    await dbVitrine('acessos').insert({
      ativacao_id: ativacaoId,
      tenant_id: tenantId,
      tipo: tipoFinal,
      referencia: referenciaFinal,
      duracao_segundos: duracao_segundos ?? null,
      totem_id: totem_id ?? null,
    });

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
