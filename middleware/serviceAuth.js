// Autenticação serviço → core (produtos chamando /api/ctx e /api/keys), mesmo padrão
// já usado em routes/tenants.js pro PROVISIONER_SECRET: token compartilhado via
// Authorization: Bearer. Sem consumidor real até a Fase 2 — token de dev por padrão.
const CORE_SERVICE_TOKEN = process.env.CORE_SERVICE_TOKEN || 'core-service-secret-change-me';

module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token || token !== CORE_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Token de serviço inválido' });
  }

  next();
};
