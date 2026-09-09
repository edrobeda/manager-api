// Fase 1 do ROADMAP.md — copia (nunca move) as tabelas operacionais do jogo de `mydb`
// pro banco novo `jogo`. Idempotente (upsert por id), seguro rodar de novo. NUNCA
// escreve em `mydb`. Precisa do core (`eventifylab`) já semeado pela Fase 0.
//
// Backfill de ativacao_id em clientes/partidas: mapeamento direto tenant_id->ativação
// de jogo (cada tenant só tem 1 ativação de jogo hoje — sem ambiguidade real). Se um dia
// um tenant rodar o jogo em mais de um evento, isso precisa evoluir pra casar por janela
// de data (partidas.jogado_em vs período de cada evento) — não implementado agora porque
// os dados de hoje já não bateriam nisso (ex.: tenant 42/LAVIZOO tem partidas fora da
// janela cadastrada do evento 3) e não haveria ganho real.
const knex = require('knex');
const mydb = knex(require('../knexfile').development);
const core = knex(require('../knexfile.core').development);
const jogo = knex(require('../knexfile.jogo').development);

async function resetSequence(table) {
  await jogo.raw(
    `SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ??), 1))`,
    [table, table]
  );
}

async function buildTenantAtivacaoMap() {
  const rows = await core('ativacoes')
    .join('produtos', 'produtos.id', 'ativacoes.produto_id')
    .join('eventos', 'eventos.id', 'ativacoes.evento_id')
    .where('produtos.slug', 'jogo')
    .select('eventos.tenant_id', 'ativacoes.id as ativacao_id');
  return Object.fromEntries(rows.map((r) => [r.tenant_id, r.ativacao_id]));
}

async function copyPremios() {
  const rows = await mydb('premios').select(
    'id', 'nome', 'subnome', 'chance', 'ativo', 'quantidade', 'tenant_id', 'tier', 'ordem', 'descricao', 'archived'
  );
  for (const r of rows) {
    await jogo('premios').insert(r).onConflict('id').merge();
  }
  console.log(`premios: ${rows.length} copiados`);
}

async function copyQuiz() {
  const rows = await mydb('quiz').select(
    'id', 'pergunta', 'primeira', 'segunda', 'terceira', 'quarta', 'correta', 'ativo', 'ultima_resposta', 'tenant_id', 'imagem_overlay'
  );
  for (const r of rows) {
    await jogo('quiz').insert(r).onConflict('id').merge();
  }
  console.log(`quiz: ${rows.length} copiados`);
}

async function copyClientes(tenantAtivacaoMap) {
  const rows = await mydb('clientes').select(
    'id', 'nome', 'cpf', 'email', 'perfil', 'criado_em', 'telefone', 'tenant_id', 'aceita_marketing', 'archived'
  );
  for (const r of rows) {
    await jogo('clientes').insert({ ...r, ativacao_id: tenantAtivacaoMap[r.tenant_id] ?? null }).onConflict('id').merge();
  }
  console.log(`clientes: ${rows.length} copiados`);
}

async function copyPartidas(tenantAtivacaoMap) {
  const rows = await mydb('partidas').select(
    'id', 'cliente_id', 'quiz_acertos', 'premio_id', 'email_enviado', 'jogado_em',
    'codigo', 'status', 'entregue_em', 'operador', 'tenant_id', 'params', 'tempo_ms'
  );
  for (const r of rows) {
    await jogo('partidas').insert({ ...r, ativacao_id: tenantAtivacaoMap[r.tenant_id] ?? null }).onConflict('id').merge();
  }
  console.log(`partidas: ${rows.length} copiados`);
}

async function main() {
  const tenantAtivacaoMap = await buildTenantAtivacaoMap();

  await copyPremios();
  await copyQuiz();
  await copyClientes(tenantAtivacaoMap); // antes de partidas (FK cliente_id)
  await copyPartidas(tenantAtivacaoMap);

  for (const table of ['premios', 'quiz', 'clientes', 'partidas']) {
    await resetSequence(table);
  }

  console.log('\nResumo final:');
  for (const table of ['premios', 'quiz', 'clientes', 'partidas']) {
    const [{ count }] = await jogo(table).count('id');
    console.log(`  ${table}: ${count}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await mydb.destroy(); await core.destroy(); await jogo.destroy(); });
