// Visão do STAFF sobre o core (ROADMAP.md Fase 0/6) — produtos, faturas de
// TODOS os tenants, contratos por tenant. Faltava desde que o core nasceu: o
// Portal do cliente (routes/portal/*) já tem isso, mas sempre escopado a 1
// tenant (req.user.tenantId); aqui é o staff vendo tudo, auth normal (JWT,
// `auth` no index.js) + authorize('superadmin'), mesmo padrão de
// routes/tenants.js.
//
// Resolve tenant por SLUG, nunca por id: `core.tenants` é uma CÓPIA de
// `mydb.tenants` feita uma única vez na Fase 0 (scripts/seed-core-from-mydb.js)
// — os ids podem ter divergido desde então pra qualquer tenant criado depois
// (ver ROADMAP.md §13, "core.users/core.tenants ficaram desatualizados").
// Slug é o identificador estável entre os dois bancos.
const router = require('express').Router();
const authorize = require('../middleware/authorize');
const dbCore = require('../db.core');

// --- produtos (catálogo do core) --------------------------------------------

router.get('/produtos', authorize('superadmin'), async (req, res) => {
  try {
    const produtos = await dbCore('produtos').select('*').orderBy('nome');
    res.json({ success: true, produtos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/produtos', authorize('superadmin'), async (req, res) => {
  try {
    const { slug, nome, surface, dominio, ativo } = req.body;
    if (!slug || !nome) return res.status(400).json({ error: 'slug e nome são obrigatórios' });

    const [produto] = await dbCore('produtos')
      .insert({ slug, nome, surface: surface || null, dominio: dominio || null, ativo: ativo ?? true })
      .returning('*');
    res.json({ success: true, produto });
  } catch (err) {
    if (String(err.message).includes('unique')) return res.status(409).json({ error: `Produto com slug "${req.body.slug}" já existe` });
    res.status(500).json({ error: err.message });
  }
});

router.put('/produtos/:id', authorize('superadmin'), async (req, res) => {
  try {
    const { nome, surface, dominio, ativo } = req.body;
    const campos = {};
    if (nome !== undefined) campos.nome = nome;
    if (surface !== undefined) campos.surface = surface || null;
    if (dominio !== undefined) campos.dominio = dominio || null;
    if (ativo !== undefined) campos.ativo = ativo;

    const [produto] = await dbCore('produtos').where({ id: req.params.id }).update(campos).returning('*');
    if (!produto) return res.status(404).json({ error: 'produto não encontrado' });
    res.json({ success: true, produto });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- faturas (cobrança — TODOS os tenants) ----------------------------------

// GET /api/core/faturas?status=&tenant_slug= — join com tenants/produtos pra
// já vir pronto pra tela (nome do tenant, nome do produto), sem N+1 no front.
router.get('/faturas', authorize('superadmin'), async (req, res) => {
  try {
    const { status, tenant_slug: tenantSlug } = req.query;

    let query = dbCore('faturas')
      .join('tenants', 'tenants.id', 'faturas.tenant_id')
      .leftJoin('tenant_produtos', 'tenant_produtos.id', 'faturas.tenant_produto_id')
      .leftJoin('produtos', 'produtos.id', 'tenant_produtos.produto_id')
      .select(
        'faturas.*',
        'tenants.slug as tenant_slug',
        'tenants.nome as tenant_nome',
        'produtos.nome as produto_nome',
        'produtos.slug as produto_slug'
      )
      .orderBy('faturas.vencimento', 'desc');

    if (status) query = query.where('faturas.status', status);
    if (tenantSlug) query = query.where('tenants.slug', tenantSlug);

    const faturas = await query;
    res.json({ success: true, faturas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- contratos por tenant (pra tela de Clientes mostrar o que cada um tem) --

// GET /api/core/tenants/:slug/produtos — contratos (tenant_produtos) do
// tenant identificado por slug (não id — ver comentário no topo do arquivo).
// Tenant sem linha correspondente no core ainda (criado só no mydb, nunca
// sincronizado) devolve lista vazia, não 404 — é um estado válido e comum
// hoje, não um erro.
router.get('/tenants/:slug/produtos', authorize('superadmin'), async (req, res) => {
  try {
    const tenant = await dbCore('tenants').where({ slug: req.params.slug }).first();
    if (!tenant) return res.json({ success: true, tenant_no_core: false, contratos: [] });

    const contratos = await dbCore('tenant_produtos')
      .where({ tenant_id: tenant.id })
      .join('produtos', 'produtos.id', 'tenant_produtos.produto_id')
      .orderBy('tenant_produtos.created_at', 'desc')
      .select(
        'tenant_produtos.*',
        'produtos.nome as produto_nome',
        'produtos.slug as produto_slug'
      );

    res.json({ success: true, tenant_no_core: true, tenant_id_core: tenant.id, contratos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
