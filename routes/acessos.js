const router = require('express').Router();
const db = require('../db');

// Deriva o evento a partir da chave de API usada — o totem nunca manda evento_id,
// pra não dar pra falsificar analytics de outro tenant.
const resolveEventoId = async (req) => {
  if (req.user?.authMethod !== 'basic') return null;
  const key = await db('basic_auth_keys').where({ id: req.user.keyId }).first();
  return key?.evento_id ?? null;
};

// Registro de página acessada dentro do totem (SPA, troca de rota sem reload)
router.post('/', async (req, res) => {
  try {
    const eventoId = await resolveEventoId(req);
    if (!eventoId) return res.status(403).json({ error: 'Chave de API sem evento vinculado' });

    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'path é obrigatório' });

    await db('acessos').insert({ evento_id: eventoId, tipo: 'pagina', referencia: path });

    res.status(201).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
