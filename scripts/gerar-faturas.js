// Fase 6 do ROADMAP.md — gera faturas do ciclo corrente pra tenant_produtos
// ativos (mensal/anual), quando ainda não existe fatura pra essa competência.
// DRY-RUN POR PADRÃO — só imprime o que seria criado. Passe --aplicar pra
// gravar de verdade. Deliberadamente NÃO é cron: gerar fatura é um evento
// financeiro, mexe com o que o cliente vê no portal (/admin/faturas, Fase 4)
// — decidido rodar sob demanda, revisado por alguém, até existir gateway de
// verdade automatizando isso (ver ROADMAP §13, gateway ainda em aberto).
//
// Uso: node scripts/gerar-faturas.js [--aplicar] [--competencia=YYYY-MM]
const knex = require('knex');
const core = knex(require('../knexfile.core').development);

const aplicar = process.argv.includes('--aplicar');
const competenciaArg = process.argv.find((a) => a.startsWith('--competencia='));
const competencia = competenciaArg
  ? competenciaArg.split('=')[1]
  : new Date().toISOString().slice(0, 7); // YYYY-MM

async function main() {
  console.log(`Gerando faturas pra competência ${competencia} (${aplicar ? 'APLICANDO' : 'dry-run, use --aplicar pra gravar'})`);

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
      await core('faturas').insert({
        tenant_id: contrato.tenant_id,
        tenant_produto_id: contrato.id,
        competencia,
        valor_centavos: contrato.valor_centavos,
        vencimento,
        status: 'aberta',
      });
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
