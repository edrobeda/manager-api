// Fase 6 do ROADMAP.md — webhook de pagamento do gateway de cobrança (Asaas
// recomendado, ver ROADMAP §8). Lado RECEPTOR (Asaas → core): valida um
// token compartilhado próprio (não é o mesmo CORE_SERVICE_TOKEN dos outros
// endpoints de serviço, mandado no header `asaas-access-token` — é o
// `authToken` configurado na própria Asaas via API, ver POST /v3/webhooks),
// atualiza `faturas.status`. Lado emissor em services/asaasClient.js.
// Validado ponta a ponta em 2026-10-14 contra uma conta SANDBOX real:
// webhook registrado via API, pagamento confirmado no sandbox, evento
// chegou aqui sozinho (levou ~25s) e atualizou a fatura sem intervenção
// manual — ver Log do ROADMAP.md. Ver scripts/gerar-faturas.js e
// scripts/suspender-inadimplentes.js pro resto do fluxo (dry-run por
// padrão, nunca automático).
const router = require('express').Router();
const dbCore = require('../db.core');

const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || null;

// Formato do payload confirmado contra o sandbox real em 2026-10-14 pro
// evento de pagamento confirmado (`event`, `payment.externalReference` ==
// faturas.id, `payment.id` == gateway_id) — PAYMENT_OVERDUE continua não
// testado de verdade (não dá pra simular vencimento no sandbox sem esperar
// a data passar).
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
