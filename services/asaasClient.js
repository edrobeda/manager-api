// Fase 6 do ROADMAP.md — lado EMISSOR (core → Asaas): cria cliente e cobrança
// de verdade na API do Asaas. Construído sem conta real pra testar contra —
// mapeamento de payload é a MELHOR ESTIMATIVA a partir da documentação
// pública deles (https://docs.asaas.com/reference). Conferir campo a campo
// assim que existir uma conta/API key real, antes de considerar isso testado
// de verdade (mesma ressalva já feita em routes/webhookAsaas.js pro lado
// receptor).
//
// Deliberadamente NÃO importado automaticamente por nada em produção: só é
// usado por scripts/gerar-faturas.js, e mesmo lá atrás de --emitir (além do
// já existente --aplicar) — ver esse arquivo pro porquê da dupla trava.
//
// Env necessárias (nenhuma delas existe hoje no .env de produção):
//   ASAAS_API_KEY  — API key da conta Asaas (sandbox ou produção)
//   ASAAS_API_URL  — opcional; default aponta pro sandbox, de propósito
//                    (produção é https://api.asaas.com/v3, mas não faz
//                    sentido apontar pra lá até existir key de produção)

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api-sandbox.asaas.com/v3';

function getApiKey() {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('ASAAS_API_KEY não configurada — gateway emissor desligado');
  return key;
}

async function asaasFetch(path, options = {}) {
  const res = await fetch(`${ASAAS_API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      access_token: getApiKey(),
      ...(options.headers || {}),
    },
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.errors?.map((e) => e.description).join('; ') || res.statusText;
    throw new Error(`Asaas ${options.method || 'GET'} ${path} → ${res.status}: ${msg}`);
  }
  return body;
}

// Busca o cliente Asaas já criado pro tenant (via tenant_faturamento.asaas_customer_id);
// se não existir, cria na Asaas e grava o id de volta. Exige cadastro fiscal
// mínimo (razao_social + documento) — sem isso o Asaas rejeita a criação.
async function garantirCustomer(dbCore, faturamento) {
  if (faturamento.asaas_customer_id) return faturamento.asaas_customer_id;

  if (!faturamento.razao_social || !faturamento.documento) {
    throw new Error(
      `tenant_faturamento (tenant_id=${faturamento.tenant_id}) sem razao_social/documento — ` +
      'preencher o cadastro fiscal no portal antes de emitir cobrança'
    );
  }

  const customer = await asaasFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: faturamento.razao_social,
      cpfCnpj: String(faturamento.documento).replace(/\D/g, ''),
      email: faturamento.contato_financeiro_email || faturamento.email_nota_fiscal || undefined,
      phone: faturamento.contato_financeiro_telefone || undefined,
      externalReference: `tenant_${faturamento.tenant_id}`,
    }),
  });

  await dbCore('tenant_faturamento')
    .where({ tenant_id: faturamento.tenant_id })
    .update({ asaas_customer_id: customer.id });

  return customer.id;
}

// Cria a cobrança na Asaas pra uma fatura já existente no core.
// `fatura` precisa ter: id, valor_centavos, vencimento.
// Retorna { gateway_id, link_pagamento } pra gravar em faturas.
async function criarCobranca({ customerId, fatura }) {
  const cobranca = await asaasFetch('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: customerId,
      billingType: 'UNDEFINED', // cliente escolhe boleto/Pix/cartão na tela do Asaas
      value: fatura.valor_centavos / 100,
      dueDate: new Date(fatura.vencimento).toISOString().slice(0, 10),
      externalReference: String(fatura.id),
      description: `Eventify Lab — competência ${fatura.competencia}`,
    }),
  });

  return {
    gateway_id: cobranca.id,
    link_pagamento: cobranca.invoiceUrl || null,
  };
}

module.exports = { garantirCustomer, criarCobranca };
