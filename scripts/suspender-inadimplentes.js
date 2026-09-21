// Fase 6 do ROADMAP.md — encontra tenant_produtos com fatura vencida há mais
// de N dias e sinaliza suspensão. DRY-RUN POR PADRÃO — só lista, nunca muda
// status sozinho sem --aplicar. Deliberadamente NÃO é cron: suspender o
// contrato de um cliente de verdade é uma decisão de negócio, não só
// técnica (ver ROADMAP §8) — precisa de alguém olhando antes de acontecer,
// pelo menos até existir gateway de pagamento de verdade rodando isso via
// webhook automatizado.
//
// Uso: node scripts/suspender-inadimplentes.js [--aplicar] [--dias=10]
const knex = require('knex');
const core = knex(require('../knexfile.core').development);

const aplicar = process.argv.includes('--aplicar');
const diasArg = process.argv.find((a) => a.startsWith('--dias='));
const dias = diasArg ? parseInt(diasArg.split('=')[1]) : 10;

async function main() {
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);

  console.log(`Faturas vencidas há mais de ${dias} dias (${aplicar ? 'APLICANDO suspensão' : 'dry-run, use --aplicar'}):`);

  const vencidas = await core('faturas')
    .where('status', 'aberta')
    .andWhere('vencimento', '<', limite)
    .select('*');

  const porContrato = new Map();
  for (const fatura of vencidas) {
    if (!fatura.tenant_produto_id) continue;
    if (!porContrato.has(fatura.tenant_produto_id)) porContrato.set(fatura.tenant_produto_id, []);
    porContrato.get(fatura.tenant_produto_id).push(fatura);
  }

  for (const [tenantProdutoId, faturas] of porContrato) {
    const contrato = await core('tenant_produtos').where({ id: tenantProdutoId }).first();
    if (!contrato || contrato.status === 'suspenso') continue;

    const tenant = await core('tenants').where({ id: contrato.tenant_id }).first();
    console.log(
      `  ! ${tenant?.slug ?? contrato.tenant_id} — tenant_produto ${tenantProdutoId}, ` +
      `${faturas.length} fatura(s) vencida(s) — marcaria como 'vencida' e suspenderia o contrato`
    );

    if (aplicar) {
      await core('faturas').whereIn('id', faturas.map((f) => f.id)).update({ status: 'vencida' });
      await core('tenant_produtos').where({ id: tenantProdutoId }).update({ status: 'suspenso' });
    }
  }

  console.log(`${porContrato.size} contrato(s) ${aplicar ? 'suspenso(s)' : 'seria(m) suspenso(s)'}.`);
  await core.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
