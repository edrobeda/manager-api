// Fase 6 do ROADMAP.md — webhook de pagamento do gateway de cobrança (Asaas
// recomendado, ver ROADMAP §8 e §13 "Questões em aberto"). Isso é só o lado
// RECEPTOR (Asaas → core): valida um token compartilhado próprio (não é o
// mesmo CORE_SERVICE_TOKEN dos outros endpoints de serviço), atualiza
// `faturas.status`. NÃO existe ainda o lado emissor (core → Asaas, criar
// cobrança de verdade) — isso precisa de uma conta Asaas real + API key,
// que não tenho; construir aquele lado sem poder testar contra a API de
// verdade seria mais risco que valor. Ver scripts/gerar-faturas.js e
// scripts/suspender-inadimplentes.js pro resto do fluxo (dry-run por
// padrão, nunca automático).
const router = require('express').Router();
const dbCore = require('../db.core');

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || null;

// Formato exato do payload do Asaas ainda não foi conferido contra a conta
// real (não existe ainda) — este mapeamento é a MELHOR ESTIMATIVA a partir
// da documentação pública deles (evento `event`, `payment.externalReference`
// == faturas.id, `payment.id` == gateway_id). Conferir contra o payload real
// assim que a conta existir, antes de considerar isso testado de verdade.
router.post('/', async (req, res) => {
  if (!ASAAS_WEBHOOK_TOKEN) {
    return res.status(503).json({ error: 'Webhook do Asaas não configurado (ASAAS_WEBHOOK_TOKEN ausente)' });
  }

  const tokenRecebido = req.headers['asaas-access-token'] || req.headers['x-webhook-token'];
  if (tokenRecebido !== ASAAS_WEBHOOK_TOKEN) {
    return res.status(401).json({ error: 'Token de webhook inválido' });
  }

  try {
    const { event, payment } = req.body;
    if (!event || !payment) return res.status(400).json({ error: 'payload inesperado' });

    const faturaId = payment.externalReference;
    if (!faturaId) return res.status(400).json({ error: 'externalReference (fatura id) ausente' });

    const fatura = await dbCore('faturas').where({ id: faturaId }).first();
    if (!fatura) return res.status(404).json({ error: 'fatura não encontrada' });

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      await dbCore('faturas').where({ id: faturaId }).update({
        status: 'paga',
        gateway: 'asaas',
        gateway_id: payment.id ?? null,
        pago_em: new Date(),
      });
    } else if (event === 'PAYMENT_OVERDUE') {
      await dbCore('faturas').where({ id: faturaId }).update({ status: 'vencida' });
    }
    // outros eventos (PAYMENT_DELETED, PAYMENT_REFUNDED etc.) — não tratados
    // ainda de propósito, sem caso de uso real pra decidir o comportamento.

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
