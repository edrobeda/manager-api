const router = require('express').Router();
const dbCore = require('../db.core');

// POST /api/uso — produto empurra métricas de uso de uma ativação (Fase 5 do
// ROADMAP.md, §3: "participantes, partidas, mensagens, cota usada"). Faz merge
// raso em ativacoes.metricas (jsonb), nunca substitui o objeto inteiro — um
// produto que manda só { mensagens: 12 } não apaga o que outro campo já tinha.
// Sem validação de shape de propósito: cada produto define suas próprias
// chaves dentro de metricas, o core só guarda e devolve.
router.post('/', async (req, res) => {
  try {
    const { ativacao_id: ativacaoId, metricas } = req.body;
    if (!ativacaoId || typeof metricas !== 'object' || metricas === null || Array.isArray(metricas)) {
      return res.status(400).json({ error: 'ativacao_id e metricas (objeto) são obrigatórios' });
    }

    const ativacao = await dbCore('ativacoes').where({ id: ativacaoId }).first();
    if (!ativacao) return res.status(404).json({ error: 'ativação não encontrada' });

    const metricasAtuais = ativacao.metricas || {};
    const metricasNovas = { ...metricasAtuais, ...metricas };

    await dbCore('ativacoes').where({ id: ativacaoId }).update({ metricas: JSON.stringify(metricasNovas) });

    res.json({ success: true, metricas: metricasNovas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
