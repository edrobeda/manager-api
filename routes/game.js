const router = require('express').Router();
const db = require('../db');

function calcStatus(evento, now = new Date()) {
  const inicio = new Date(evento.data_inicio);
  const fim    = new Date(evento.data_fim);
  if (now < inicio) return 'agendado';
  if (now > fim)    return 'encerrado';
  return 'ativo';
}

// GET /api/game/status
// Requer BasicAuth. Valida a chave e retorna se o evento vinculado está ativo.
router.get('/status', async (req, res) => {
  try {
    if (req.user.authMethod !== 'basic') {
      return res.status(403).json({ error: 'Apenas BasicAuth pode acessar este endpoint' });
    }

    const key = await db('basic_auth_keys').where({ id: req.user.keyId }).first();

    if (!key?.evento_id) {
      // Chave válida sem evento vinculado → game ativo enquanto a chave existir
      return res.json({ ativo: true, motivo: null, evento: null });
    }

    const evento = await db('eventos').where({ id: key.evento_id }).first();
    if (!evento) return res.json({ ativo: false, motivo: 'evento_nao_encontrado', evento: null });

    const status = calcStatus(evento);
    const ativo  = status === 'ativo';

    res.json({
      ativo,
      motivo: ativo ? null : status,
      evento: {
        id:          evento.id,
        nome:        evento.nome,
        status,
        data_inicio: evento.data_inicio,
        data_fim:    evento.data_fim,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
