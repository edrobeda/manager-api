const router = require('express').Router();

// POST /api/webhooks/subscribe { produto, url, eventos: [] }
// Stub — ainda não há consumidores reais (Vitrine/Jogo nascem na Fase 2). Valida o
// formato e responde de volta; persistência de assinaturas fica pra quando existir
// alguém de verdade consumindo (TODO: tabela de subscriptions + disparo real).
router.post('/subscribe', async (req, res) => {
  const { produto, url } = req.body;
  if (!produto || !url) return res.status(400).json({ error: 'produto e url são obrigatórios' });

  res.json({ success: true, received: { produto, url, eventos: req.body.eventos ?? [] } });
});

module.exports = router;
