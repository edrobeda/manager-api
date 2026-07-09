const router = require('express').Router();
const bcrypt = require('bcryptjs');
const authorize = require('../middleware/authorize');
const db = require('../db');

const PROVISIONER_URL = process.env.PROVISIONER_URL || 'http://172.19.0.1:3030';
const PROVISIONER_SECRET = process.env.PROVISIONER_SECRET || 'provisioner-secret-change-me';

// Listar todos os tenants
router.get('/', authorize('superadmin'), async (req, res) => {
  try {
    const tenants = await db('tenants').select('*').orderBy('nome');
    res.json({ success: true, tenants });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar tenant
router.post('/', authorize('superadmin'), async (req, res) => {
  try {
    const { nome, slug, logo_url, cor_primaria } = req.body;
    if (!nome || !slug) return res.status(400).json({ error: 'Nome e slug são obrigatórios' });

    const [tenant] = await db('tenants').insert({ nome, slug, logo_url, cor_primaria }).returning('*');
    res.status(201).json({ success: true, tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar tenant
router.put('/:id', authorize('superadmin'), async (req, res) => {
  try {
    const { nome, slug, logo_url, cor_primaria } = req.body;
    const [tenant] = await db('tenants').where({ id: req.params.id }).update({ nome, slug, logo_url, cor_primaria }).returning('*');
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });
    res.json({ success: true, tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar usuários do tenant
router.get('/:id/users', authorize('superadmin'), async (req, res) => {
  try {
    const users = await db('users').where({ tenant_id: req.params.id }).select('id', 'nome', 'email', 'role', 'created_at');
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar usuário no tenant
router.post('/:id/users', authorize('superadmin'), async (req, res) => {
  try {
    const { nome, email, password, role = 'admin' } = req.body;
    if (!nome || !email || !password) return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });

    const senha = await bcrypt.hash(password, 10);
    const [user] = await db('users').insert({ nome, email, senha, role, tenant_id: req.params.id }).returning('id', 'nome', 'email', 'role', 'ativo');
    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle ativo do tenant (superadmin)
router.patch('/:id/toggle', authorize('superadmin'), async (req, res) => {
  try {
    const [tenant] = await db('tenants').where({ id: req.params.id }).select('ativo');
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

    const [updated] = await db('tenants').where({ id: req.params.id })
      .update({ ativo: !tenant.ativo }).returning('id', 'nome', 'slug', 'ativo');
    res.json({ success: true, tenant: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle ativo de um usuário do tenant (superadmin)
router.patch('/:id/users/:userId/toggle', authorize('superadmin'), async (req, res) => {
  try {
    const [user] = await db('users').where({ id: req.params.userId, tenant_id: req.params.id }).select('ativo');
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const [updated] = await db('users').where({ id: req.params.userId })
      .update({ ativo: !user.ativo }).returning('id', 'nome', 'email', 'role', 'ativo');
    res.json({ success: true, user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Provisionar game white-label para o tenant
router.post('/:id/provisionar', authorize('superadmin'), async (req, res) => {
  try {
    const tenant = await db('tenants').where({ id: req.params.id }).first();
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

    const { data_inicio, data_fim, alias } = req.body;

    // Remove prefixo game- caso o slug já tenha sido salvo assim
    const baseSlug = tenant.slug.replace(/^game-/, '');

    // URL principal do game: alias personalizado ou padrão game-{slug}
    const aliasNorm = alias
      ? alias.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      : null;
    const gameUrl    = aliasNorm ? `${aliasNorm}.eventifylab.com`         : `game-${baseSlug}.eventifylab.com`;
    const managerUrl = aliasNorm ? `${aliasNorm}-manager.eventifylab.com` : `game-${baseSlug}-manager.eventifylab.com`;

    // Salva as URLs antecipadamente para que o polling de status possa usá-las
    await db('tenants').where({ id: req.params.id }).update({ game_url: gameUrl });

    const payload = {
      slug:         baseSlug,
      cor_primaria: tenant.cor_primaria || '#10b981',
      titulo:       tenant.nome,
      tenant_id:    tenant.id,
      data_inicio:  data_inicio || null,
      data_fim:     data_fim    || null,
      alias:        alias || null,
    };

    const response = await fetch(`${PROVISIONER_URL}/provisionar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${PROVISIONER_SECRET}` },
      body:    JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    res.json({ success: true, gameUrl, managerUrl, ...data });
  } catch (err) {
    res.status(500).json({ error: `Erro ao contatar provisionador: ${err.message}` });
  }
});

// Status do provisionamento de um tenant
router.get('/:id/provisionar/status', authorize('superadmin'), async (req, res) => {
  try {
    const tenant = await db('tenants').where({ id: req.params.id }).first();
    if (!tenant) return res.status(404).json({ error: 'Tenant não encontrado' });

    const response = await fetch(`${PROVISIONER_URL}/status/${tenant.slug}`, {
      headers: { Authorization: `Bearer ${PROVISIONER_SECRET}` },
    });

    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);

    if (data.status === 'concluido' && data.credentials && !tenant.game_credentials) {
      const gUrl = tenant.game_url || `game-${tenant.slug}.eventifylab.com`;
      const mUrl = gUrl.replace('.eventifylab.com', '-manager.eventifylab.com');
      const creds = {
        ...data.credentials,
        url:         gUrl,
        manager_url: mUrl,
        provisioned_at: data.finishedAt,
      };
      await db('tenants').where({ id: req.params.id }).update({ game_credentials: JSON.stringify(creds) });
    }

    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ error: `Erro ao contatar provisionador: ${err.message}` });
  }
});

module.exports = router;
