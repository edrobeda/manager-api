// Gera 1 fatura pra 1 contrato (tenant_produtos) — extraído de
// scripts/gerar-faturas.js pra ser reusado também por uma ação explícita de
// staff ("confirmar contrato", routes/core.js), não só pelo job manual
// recorrente. Ver ROADMAP.md, Fase 6 e o fluxo de staff fechado depois dela.
//
// Diferença de uso entre os dois consumidores: o script só chama isso pra
// contratos `mensal`/`anual` (ciclo recorrente, 1x por competência); o
// endpoint de confirmação chama pra QUALQUER ciclo (inclusive `por_evento`,
// que o script nunca fatura sozinho) — é uma ação pontual decidida por quem
// está confirmando, não o job de competência.
const { garantirCustomer, criarCobranca } = require('./asaasClient');

// `competencia` null é válido (ex. contrato `por_evento`, sem "mês de referência");
// vira a string `'unica'` só pra não deixar a coluna sem nada de útil pra
// identificar essa fatura entre as recorrentes do mesmo contrato.
async function gerarFaturaParaContrato(core, contrato, { competencia = null, vencimento = null, emitir = false } = {}) {
  const competenciaFatura = competencia ?? 'unica';
  // Sem vencimento explícito (caso do script, que usa o dia 5 da competência):
  // vence em 5 dias, sem regra fina ainda — é o caso da confirmação pontual de
  // staff, que não tem "mês de referência" pra calcular a partir dele.
  const vencimentoFatura = vencimento ?? new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);

  const [fatura] = await core('faturas')
    .insert({
      tenant_id: contrato.tenant_id,
      tenant_produto_id: contrato.id,
      competencia: competenciaFatura,
      valor_centavos: contrato.valor_centavos,
      vencimento: vencimentoFatura,
      status: 'aberta',
    })
    .returning('*');

  if (!emitir) return { fatura, emissao: null, erroEmissao: null };

  try {
    const faturamento = await core('tenant_faturamento').where({ tenant_id: contrato.tenant_id }).first();
    if (!faturamento) throw new Error('sem cadastro fiscal (tenant_faturamento) pra esse tenant');

    const customerId = await garantirCustomer(core, faturamento);
    const { gateway_id, link_pagamento } = await criarCobranca({ customerId, fatura });

    await core('faturas').where({ id: fatura.id }).update({ gateway: 'asaas', gateway_id, link_pagamento });
    fatura.gateway = 'asaas';
    fatura.gateway_id = gateway_id;
    fatura.link_pagamento = link_pagamento;
    return { fatura, emissao: { gateway_id, link_pagamento }, erroEmissao: null };
  } catch (err) {
    // Fatura local já existe (status 'aberta') mesmo se a emissão falhar — não
    // deixa a falta de gateway/cadastro fiscal travar o registro financeiro local.
    return { fatura, emissao: null, erroEmissao: err.message };
  }
}

module.exports = { gerarFaturaParaContrato };
