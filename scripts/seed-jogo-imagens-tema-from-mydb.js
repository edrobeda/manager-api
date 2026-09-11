// Fase 2 do ROADMAP.md — copia (nunca move) imagens_tema de `mydb` pro banco `jogo`.
// Mesmo padrão de scripts/seed-jogo-from-mydb.js (upsert idempotente por id). NUNCA
// escreve em `mydb`.
const knex = require('knex');
const mydb = knex(require('../knexfile').development);
const jogo = knex(require('../knexfile.jogo').development);

async function resetSequence(table) {
  await jogo.raw(
    `SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ??), 1))`,
    [table, table]
  );
}

async function copyImagensTema() {
  const rows = await mydb('imagens_tema').select('id', 'chave', 'caminho', 'tenant_id', 'atualizado_em');
  for (const r of rows) {
    await jogo('imagens_tema').insert(r).onConflict('id').merge();
  }
  console.log(`imagens_tema: ${rows.length} copiados`);
}

async function main() {
  await copyImagensTema();
  await resetSequence('imagens_tema');
  console.log('OK');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
