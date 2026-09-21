// Fase 6 do ROADMAP.md — gera faturas do ciclo corrente pra tenant_produtos
// ativos (mensal/anual), quando ainda não existe fatura pra essa competência.
// DRY-RUN POR PADRÃO — só imprime o que seria criado. Passe --aplicar pra
// gravar de verdade. Deliberadamente NÃO é cron: gerar fatura é um evento
// financeiro, mexe com o que o cliente vê no portal (/admin/faturas, Fase 4)
// — decidido rodar sob demanda, revisado por alguém.
//
// Lado emissor (Fase 6, ROADMAP §8): com --aplicar --emitir e ASAAS_API_KEY
// configurada, além de gravar a fatura local também cria a cobrança de
// verdade na Asaas (services/asaasClient.js) e grava gateway/gateway_id/
// link_pagamento. Trava dupla de propósito — nunca testado contra API real
// (sem conta Asaas ainda) — só liga quando alguém pedir --emitir
// explicitamente, mesmo depois da key existir.
//
// Uso: node scripts/gerar-faturas.js [--aplicar] [--emitir] [--competencia=YYYY-MM]
const knex = require('knex');
const core = knex(require('../knexfile.core').development);
const { garantirCustomer, criarCobranca } = require('../services/asaasClient');

const aplicar = process.argv.includes('--aplicar');
const emitir = process.argv.includes('--emitir');
const competenciaArg = process.argv.find((a) => a.startsWith('--competencia='));
const competencia = competenciaArg
  ? competenciaArg.split('=')[1]
  : new Date().toISOString().slice(0, 7); // YYYY-MM

async function main() {
  if (emitir && !aplicar) {
    console.error('--emitir só faz sentido junto com --aplicar (senão não há fatura local pra vincular à cobrança).');
    process.exit(1);
  }
  console.log(
    `Gerando faturas pra competência ${competencia} ` +
    `(${aplicar ? 'APLICANDO' : 'dry-run, use --aplicar pra gravar'}` +
    `${emitir ? ' + EMITINDO na Asaas' : ''})`
  );

  const contratos = await core('tenant_produtos')
    .whereIn('status', ['ativo', 'trial'])
    .whereIn('ciclo', ['mensal', 'anual'])
    .select('*');

  let criadas = 0;
  for (const contrato of contratos) {
    const jaExiste = await core('faturas')
      .where({ tenant_produto_id: contrato.id, competencia })
      .first();
    if (jaExiste) continue;

    const tenant = await core('tenants').where({ id: contrato.tenant_id }).first();
    const vencimento = new Date(`${competencia}-05`); // dia 5 do mês, sem regra fina ainda

    console.log(
      `  + ${tenant?.slug ?? contrato.tenant_id} — tenant_produto ${contrato.id}, plano ${contrato.plano}, ` +
      `R$ ${(contrato.valor_centavos / 100).toFixed(2)}, vence ${vencimento.toISOString().slice(0, 10)}`
    );

    if (aplicar) {
      const [fatura] = await core('faturas')
        .insert({
          tenant_id: contrato.tenant_id,
          tenant_produto_id: contrato.id,
          competencia,
          valor_centavos: contrato.valor_centavos,
          vencimento,
          status: 'aberta',
        })
        .returning('*');

      if (emitir) {
        try {
          const faturamento = await core('tenant_faturamento').where({ tenant_id: contrato.tenant_id }).first();
          if (!faturamento) throw new Error('sem cadastro fiscal (tenant_faturamento) pra esse tenant');

          const customerId = await garantirCustomer(core, faturamento);
          const { gateway_id, link_pagamento } = await criarCobranca({ customerId, fatura });

          await core('faturas').where({ id: fatura.id }).update({ gateway: 'asaas', gateway_id, link_pagamento });
          console.log(`    ↳ emitida na Asaas: ${link_pagamento || gateway_id}`);
        } catch (err) {
          // Fatura local já existe (status 'aberta') mesmo se a emissão falhar —
          // não deixa a falta de gateway travar o registro financeiro local.
          console.error(`    ↳ falhou ao emitir na Asaas: ${err.message}`);
        }
      }
    }
    criadas++;
  }

  console.log(`${criadas} fatura(s) ${aplicar ? 'criada(s)' : 'seria(m) criada(s)'}.`);
  await core.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
