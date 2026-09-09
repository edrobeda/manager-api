// Fase 1 do ROADMAP.md — "job de órfãos": sem FK entre bancos (core/vitrine/jogo), então
// a integridade referencial é responsabilidade da aplicação. Este script só LÊ os 3
// bancos e reporta tenant_id/ativacao_id órfãos (presentes em vitrine/jogo mas ausentes
// no core) — não corrige nada sozinho. Rodar sob demanda (npm run check-orphans); vira
// cron quando os apps da Fase 2 existirem e passarem a escrever de verdade nesses bancos.
const knex = require('knex');
const core = knex(require('../knexfile.core').development);
const vitrine = knex(require('../knexfile.vitrine').development);
const jogo = knex(require('../knexfile.jogo').development);

async function distinctValues(db, table, column) {
  const rows = await db(table).distinct(column).whereNotNull(column);
  return rows.map((r) => r[column]);
}

function checkOrphans(label, values, validSet) {
  const orphans = [...new Set(values)].filter((v) => !validSet.has(v));
  if (orphans.length > 0) {
    console.log(`ÓRFÃO em ${label}: ${orphans.join(', ')}`);
  }
  return orphans.length;
}

async function main() {
  const validTenantIds = new Set((await core('tenants').select('id')).map((r) => r.id));
  const validAtivacaoIds = new Set((await core('ativacoes').select('id')).map((r) => r.id));

  let totalOrphans = 0;

  for (const table of ['produtos_totem', 'config_totem']) {
    totalOrphans += checkOrphans(`vitrine.${table}.tenant_id`, await distinctValues(vitrine, table, 'tenant_id'), validTenantIds);
  }
  for (const table of ['short_links', 'acessos']) {
    totalOrphans += checkOrphans(`vitrine.${table}.tenant_id`, await distinctValues(vitrine, table, 'tenant_id'), validTenantIds);
    totalOrphans += checkOrphans(`vitrine.${table}.ativacao_id`, await distinctValues(vitrine, table, 'ativacao_id'), validAtivacaoIds);
  }
  for (const table of ['premios', 'quiz']) {
    totalOrphans += checkOrphans(`jogo.${table}.tenant_id`, await distinctValues(jogo, table, 'tenant_id'), validTenantIds);
  }
  for (const table of ['clientes', 'partidas']) {
    totalOrphans += checkOrphans(`jogo.${table}.tenant_id`, await distinctValues(jogo, table, 'tenant_id'), validTenantIds);
    totalOrphans += checkOrphans(`jogo.${table}.ativacao_id`, await distinctValues(jogo, table, 'ativacao_id'), validAtivacaoIds);
  }

  console.log(totalOrphans === 0 ? '\n0 órfãos encontrados.' : `\n${totalOrphans} órfão(s) encontrado(s).`);
  process.exitCode = totalOrphans === 0 ? 0 : 1;
}

main()
  .catch((err) => { console.error(err); process.exitCode = 2; })
  .finally(async () => { await core.destroy(); await vitrine.destroy(); await jogo.destroy(); });
