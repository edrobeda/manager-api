// Auth de dispositivo pro app Vitrine multitenant (Fase 2) — mesmo formato Basic
// name:token do totem legado, mas resolve via core (eventifylab) em vez de
// basic_auth_keys local, e exige que a chave esteja vinculada a uma ativação do
// produto "vitrine". Rotas legadas do totem_vetnil continuam usando
// middleware/basicAuth.js contra mydb, intocado.
const { resolveAtivacaoPorToken } = require('../utils/resolveAtivacao');

module.exports = async (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return res.status(401).json({ error: 'Autenticação necessária' });

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const colonIdx = decoded.indexOf(':');
  const token = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : decoded;
  if (!token) return res.status(401).json({ error: 'Credenciais inválidas' });

  try {
    const contexto = await resolveAtivacaoPorToken(token);
    if (!contexto) return res.status(401).json({ error: 'Chave de API inválida ou inativa' });
    if (contexto.produto !== 'vitrine') return res.status(403).json({ error: 'Chave não vinculada a uma ativação de vitrine' });
    if (!contexto.tenant_id) return res.status(403).json({ error: 'Ativação sem tenant resolvido' });

    req.ativacao = contexto;
    next();
  } catch {
    return res.status(500).json({ error: 'Erro interno de autenticação' });
  }
};
