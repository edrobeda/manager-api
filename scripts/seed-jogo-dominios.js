// Fase 2 do ROADMAP.md — popula a tabela `dominios` (core) com os domínios públicos
// de game-vetnil e game-vetnil-pet, apontando pra ativação `jogo` de cada tenant.
// Idempotente (upsert por host). Cada jogo responde em 2 domínios (canônico + alias
// legado) — as duas linhas apontam pra mesma ativação.
const knex = require('knex');
const core = knex(require('../knexfile.core').development);

const DOMINIOS = [
  { host: 'vetnil-biocell.eventifylab.com', ativacao_id: 3 }, // Vetnil (tenant 2)
  { host: 'game-vetnil.eventifylab.com', ativacao_id: 3 },
  { host: 'game-vetnil-pet.eventifylab.com', ativacao_id: 5 }, // Vetnil-Pet (tenant 45)
  { host: 'vetnil-pet.eventifylab.com', ativacao_id: 5 },
];

async function main() {
  for (const row of DOMINIOS) {
    await core('dominios').insert(row).onConflict('host').merge();
    console.log(`dominios: ${row.host} -> ativacao_id=${row.ativacao_id}`);
  }
  console.log('OK');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
