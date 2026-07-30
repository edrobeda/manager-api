const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'eventifylab-secret-2026';

router.post('/login', async (req, res) => {
  const { email, password, slug } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const valid = await bcrypt.compare(password, user.senha);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    // Se veio slug (acesso por subdomínio), validar que o usuário pertence ao tenant
    if (slug) {
      const tenant = await db('tenants').where({ slug }).first();
      if (!tenant) return res.status(401).json({ error: 'Portal não encontrado' });
      if (user.tenant_id !== tenant.id && user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Usuário não pertence a este portal' });
      }
    }

    let tenant = null;
    if (user.tenant_id) {
      tenant = await db('tenants').where({ id: user.tenant_id }).first();
    }

    const token = jwt.sign(
      { userId: user.id, tenantId: user.tenant_id, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, nome: user.nome, email: user.email, role: user.role },
      tenant: tenant
        ? { id: tenant.id, nome: tenant.nome, slug: tenant.slug, cor_primaria: tenant.cor_primaria, logo_url: tenant.logo_url }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gateway de autenticacao para subdominios internos (ex.: opencode.eventifylab.com).
// Chamado pelo Caddy `forward_auth`. Retorna 200 quando o usuario esta autenticado no Manager,
// 401 caso contrario. Aceita JWT via Authorization Bearer OU cookie cross-subdomain `manager_token`.
router.get('/check', (req, res) => {
  let token = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)manager_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1]);
  }
  if (!token) return res.status(401).json({ error: 'Nao autenticado' });
  try {
    jwt.verify(token, JWT_SECRET);
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
});

module.exports = router;
