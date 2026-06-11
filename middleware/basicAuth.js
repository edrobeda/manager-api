const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'eventifylab-secret-2026';

// Aceita Bearer JWT ou Basic Auth (nome:token)
module.exports = async (req, res, next) => {
  const header = req.headers.authorization || '';

  if (header.startsWith('Bearer ')) {
    const token = header.split(' ')[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    if (req.user.role === 'superadmin') return next();

    try {
      const user = await db('users').where({ id: req.user.userId }).select('ativo').first();
      if (!user || user.ativo === false) return res.status(401).json({ error: 'Acesso revogado' });

      if (req.user.tenantId) {
        const tenant = await db('tenants').where({ id: req.user.tenantId }).select('ativo').first();
        if (!tenant || tenant.ativo === false) return res.status(403).json({ error: 'Acesso do tenant revogado' });
      }
      return next();
    } catch {
      return res.status(500).json({ error: 'Erro interno de autenticação' });
    }
  }

  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.split(' ')[1], 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    const token = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;

    if (!token) return res.status(401).json({ error: 'Credenciais inválidas' });

    const hash = crypto.createHash('sha256').update(token).digest('hex');

    try {
      const key = await db('basic_auth_keys').where({ token_hash: hash, ativo: true }).first();
      if (!key) return res.status(401).json({ error: 'Chave de API inválida ou inativa' });

      req.user = { role: 'superadmin', authMethod: 'basic', keyId: key.id, keyNome: key.nome };
      return next();
    } catch {
      return res.status(500).json({ error: 'Erro interno de autenticação' });
    }
  }

  return res.status(401).json({ error: 'Autenticação necessária' });
};
