const router = require('express').Router();
const db = require('../db');

const tenantFilter = (req) =>
  req.user.role === 'superadmin' ? {} : { 'produtos_totem.tenant_id': req.user.tenantId };

const slugify = (texto) => texto
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// Gera um slug único dentro do tenant (considerando apenas o idioma canônico pt),
// adicionando sufixo -2, -3... em caso de colisão
const gerarSlugUnico = async (tenant_id, nome) => {
  const base = slugify(nome) || 'produto';
  let slug = base;
  let contador = 2;
  while (await db('produtos_totem').where({ tenant_id, slug, lang: 'pt' }).first()) {
    slug = `${base}-${contador}`;
    contador += 1;
  }
  return slug;
};

// A série é a fonte de verdade do agrupamento; produtos_totem.serie guarda o nome dela
// para o totem em produção, que lê esse campo, continuar funcionando.
// Aceita 'serie' em texto (versões antigas do manager-skin) criando a série se ainda não existir.
const resolverSerie = async (tenant_id, { serie_id, serie }) => {
  if (serie_id) {
    const existente = await db('series_totem').where({ id: serie_id, tenant_id }).first();
    if (!existente) throw new Error('Série não encontrada para este tenant');
    return { serie_id: existente.id, serie: existente.nome };
  }

  if (!serie) return { serie_id: null, serie: null };

  const existente = await db('series_totem').where({ tenant_id, nome: serie }).first();
  if (existente) return { serie_id: existente.id, serie: existente.nome };

  const ultima = await db('series_totem').where({ tenant_id }).max('ordem as max').first();
  const [criada] = await db('series_totem')
    .insert({ tenant_id, nome: serie, ordem: (ultima?.max ?? -1) + 1 })
    .returning('*');
  return { serie_id: criada.id, serie: criada.nome };
};

// Lista produtos do tenant (idioma pt por padrão — traduções ficam ocultas da listagem principal)
router.get('/', async (req, res) => {
  try {
    const produtos = await db('produtos_totem')
      .leftJoin('series_totem', 'series_totem.id', 'produtos_totem.serie_id')
      .where(tenantFilter(req))
      .where('lang', req.query.lang || 'pt')
      .select('produtos_totem.*', 'series_totem.ordem as serie_ordem');
    produtos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    res.json({ success: true, produtos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const where = { id: req.params.id, ...tenantFilter(req) };
    const produto = await db('produtos_totem').where(where).first();
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ success: true, produto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cria produto
router.post('/', async (req, res) => {
  try {
    const {
      nome, linha, descricao_curta, descricao,
      imagem_produto_url, imagem_banner_url, video_url, video_local_url, url_ficha,
      extras, ordem, evento_id, lang, slug: slugTraducao, destaque, serie, serie_id, banner_institucional,
    } = req.body;

    if (!nome || !linha) return res.status(400).json({ error: 'Nome e linha são obrigatórios' });

    const tenant_id = req.user.role === 'superadmin'
      ? req.body.tenant_id
      : req.user.tenantId;

    if (!tenant_id) return res.status(400).json({ error: 'tenant_id obrigatório' });

    // Traduções (lang != 'pt') reaproveitam o slug do produto pt já existente,
    // em vez de gerar um slug novo — o totem usa o mesmo slug pra achar as variações de idioma.
    let slug;
    if (lang && lang !== 'pt') {
      if (!slugTraducao) return res.status(400).json({ error: 'slug é obrigatório para traduções' });
      const original = await db('produtos_totem').where({ tenant_id, slug: slugTraducao, lang: 'pt' }).first();
      if (!original) return res.status(404).json({ error: 'Produto pt com esse slug não encontrado' });
      slug = slugTraducao;
    } else {
      slug = await gerarSlugUnico(tenant_id, nome);
    }

    const vinculoSerie = await resolverSerie(tenant_id, { serie_id, serie });

    const [produto] = await db('produtos_totem').insert({
      tenant_id, slug, lang: lang || 'pt', nome, linha, descricao_curta, descricao,
      imagem_produto_url, imagem_banner_url, video_url, video_local_url, url_ficha,
      extras: extras ?? {}, ordem: ordem ?? 0, evento_id: evento_id || null,
      destaque: destaque ?? false, ...vinculoSerie,
      banner_institucional: banner_institucional ?? false,
    }).returning('*');

    res.status(201).json({ success: true, produto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edita produto
router.put('/:id', async (req, res) => {
  try {
    const where = { id: req.params.id, ...tenantFilter(req) };
    const {
      nome, linha, descricao_curta, descricao,
      imagem_produto_url, imagem_banner_url, video_url, video_local_url, url_ficha,
      extras, ordem, evento_id, ativo, destaque, serie, serie_id, banner_institucional,
    } = req.body;

    const atual = await db('produtos_totem').where(where).first();
    if (!atual) return res.status(404).json({ error: 'Produto não encontrado' });

    // Série só é mexida quando o payload fala dela — assim um PUT parcial
    // (ex: só o switch de destaque na listagem) não desvincula o produto da seção.
    const mudouSerie = serie_id !== undefined || serie !== undefined;
    const vinculoSerie = mudouSerie
      ? await resolverSerie(atual.tenant_id, { serie_id, serie })
      : {};

    // Slug é gerado uma única vez na criação e não muda em edições,
    // para não quebrar links/QR codes já publicados no totem.
    const [produto] = await db('produtos_totem').where(where).update({
      nome, linha, descricao_curta, descricao,
      imagem_produto_url, imagem_banner_url, video_url, video_local_url, url_ficha,
      extras, ordem, evento_id: evento_id === undefined ? undefined : (evento_id || null),
      ativo, destaque, ...vinculoSerie,
      banner_institucional, updated_at: db.fn.now(),
    }).returning('*');

    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ success: true, produto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove produto (soft delete — ativo=false, conforme padrão do projeto)
router.delete('/:id', async (req, res) => {
  try {
    const where = { id: req.params.id, ...tenantFilter(req) };
    const [produto] = await db('produtos_totem').where(where)
      .update({ ativo: false, updated_at: db.fn.now() })
      .returning('*');
    if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
