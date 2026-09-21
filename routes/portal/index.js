const router = require('express').Router();

// Portal do cliente (Fase 4 do ROADMAP.md) — agrega os sub-routers, todos contra o
// banco core (db.core.js), montado em index.js como:
//   app.use('/api/portal', auth, require('./routes/portal'))
router.use('/faturamento', require('./faturamento'));
router.use('/contratos', require('./contratos'));
router.use('/eventos', require('./eventos'));
router.use('/ativacoes', require('./ativacoes'));
router.use('/faturas', require('./faturas'));

module.exports = router;
