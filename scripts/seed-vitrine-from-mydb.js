// Fase 1 do ROADMAP.md — copia (nunca move) as tabelas operacionais da vitrine de
// `mydb` pro banco novo `vitrine`. Idempotente (upsert por id), seguro rodar de novo.
// NUNCA escreve em `mydb`. Precisa do core (`eventifylab`) já semeado pela Fase 0.
const knex = require('knex');
const mydb = knex(require('../knexfile').development);
const core = knex(require('../knexfile.core').development);
const vitrine = knex(require('../knexfile.vitrine').development);

async function resetSequence(table) {
  await vitrine.raw(
    `SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ??), 1))`,
    [table, table]
  );
}

async function buildTenantAtivacaoMap() {
  const rows = await core('ativacoes')
    .join('produtos', 'produtos.id', 'ativacoes.produto_id')
    .join('eventos', 'eventos.id', 'ativacoes.evento_id')
    .where('produtos.slug', 'vitrine')
    .select('eventos.tenant_id', 'ativacoes.id as ativacao_id');
  return Object.fromEntries(rows.map((r) => [r.tenant_id, r.ativacao_id]));
}

async function copyProdutosTotem() {
  const rows = await mydb('produtos_totem').select(
    'id', 'tenant_id', 'slug', 'linha', 'descricao_curta', 'descricao',
    'imagem_produto_url', 'imagem_banner_url', 'video_url', 'video_local_url',
    'extras', 'ordem', 'ativo', 'nome', 'lang', 'destaque', 'serie', 'url_ficha',
    'banner_institucional', 'created_at', 'updated_at'
  );
  for (const r of rows) {
    await vitrine('produtos_totem').insert(r).onConflict('id').merge();
  }
  console.log(`produtos_totem: ${rows.length} copiados`);
}

async function copyConfigTotem() {
  const rows = await mydb('config_totem').select(
    'id', 'tenant_id', 'config_slug', 'valor', 'tipo', 'ativo', 'created_at', 'updated_at'
  );
  for (const r of rows) {
    await vitrine('config_totem').insert(r).onConflict('id').merge();
  }
  console.log(`config_totem: ${rows.length} copiados`);
}

async function copyShortLinks(eventoTenantMap, tenantAtivacaoMap) {
  const rows = await mydb('short_links').select('id', 'codigo', 'url_destino', 'evento_id', 'criado_em');
  for (const r of rows) {
    const tenantId = eventoTenantMap[r.evento_id] ?? null;
    const ativacaoId = tenantAtivacaoMap[tenantId] ?? null;
    await vitrine('short_links').insert({
      id: r.id, codigo: r.codigo, url_destino: r.url_destino,
      ativacao_id: ativacaoId, tenant_id: tenantId, criado_em: r.criado_em,
    }).onConflict('id').merge();
  }
  console.log(`short_links: ${rows.length} copiados`);
}

async function copyAcessos(eventoTenantMap, tenantAtivacaoMap) {
  const rows = await mydb('acessos').select(
    'id', 'evento_id', 'tipo', 'referencia', 'short_link_id', 'criado_em', 'duracao_segundos', 'totem_id'
  );
  for (const r of rows) {
    const tenantId = eventoTenantMap[r.evento_id] ?? null;
    const ativacaoId = tenantAtivacaoMap[tenantId] ?? null;
    await vitrine('acessos').insert({
      id: r.id, ativacao_id: ativacaoId, tenant_id: tenantId, tipo: r.tipo,
      referencia: r.referencia, short_link_id: r.short_link_id, criado_em: r.criado_em,
      duracao_segundos: r.duracao_segundos, totem_id: r.totem_id,
    }).onConflict('id').merge();
  }
  console.log(`acessos: ${rows.length} copiados`);
}

async function main() {
  const eventos = await mydb('eventos').select('id', 'tenant_id');
  const eventoTenantMap = Object.fromEntries(eventos.map((e) => [e.id, e.tenant_id]));
  const tenantAtivacaoMap = await buildTenantAtivacaoMap();

  await copyProdutosTotem();
  await copyConfigTotem();
  await copyShortLinks(eventoTenantMap, tenantAtivacaoMap);
  await copyAcessos(eventoTenantMap, tenantAtivacaoMap);

  for (const table of ['produtos_totem', 'config_totem', 'short_links', 'acessos']) {
    await resetSequence(table);
  }

  console.log('\nResumo final:');
  for (const table of ['produtos_totem', 'config_totem', 'short_links', 'acessos']) {
    const [{ count }] = await vitrine(table).count('id');
    console.log(`  ${table}: ${count}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await mydb.destroy(); await core.destroy(); await vitrine.destroy(); });
