const router = require('express').Router();
const bcrypt = require('bcryptjs');
const authorize = require('../middleware/authorize');
const db = require('../db');

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

// Listar usuários do tenant (inclui campo ativo)
module.exports = router;
