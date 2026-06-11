const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'eventifylab-secret-2026';

module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  // superadmin não tem tenant — pula verificação de tenant
  if (req.user.role === 'superadmin') return next();

  try {
    // verifica se usuário ainda está ativo
    const user = await db('users').where({ id: req.user.userId }).select('ativo').first();
    if (!user || user.ativo === false) {
      return res.status(401).json({ error: 'Acesso revogado' });
    }

    // verifica se tenant está ativo
    if (req.user.tenantId) {
      const tenant = await db('tenants').where({ id: req.user.tenantId }).select('ativo').first();
      if (!tenant || tenant.ativo === false) {
        return res.status(403).json({ error: 'Acesso do tenant revogado' });
      }
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno de autenticação' });
  }
};
