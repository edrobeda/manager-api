// Fase 0 do ROADMAP.md — copia (nunca move) dados de `mydb` pro banco novo `eventifylab`,
// semeia o catálogo de produtos e infere tenant_produtos/ativacoes a partir do uso real.
// Idempotente (upsert por id/slug) — seguro rodar de novo. NUNCA escreve em `mydb`.
//
// Abre conexões próprias (não os singletons db.js/db.core.js) pra fechar o pool no final
// e não deixar o processo pendurado depois do script terminar.
const knex = require('knex');
const mydb = knex(require('../knexfile').development);
const core = knex(require('../knexfile.core').development);

// Decisões fechadas em 2026-09-09 (ver ROADMAP.md e plano da Fase 0):
// - evento 7 (dummy "Totem Vetnil - Showroom", tenant 2, zero dado real) é copiado mas
//   não gera ativação.
// - tenants 43/44 (sinal de uso fraco) entram como tenant_produtos.status = 'trial'.
const EVENTO_IDS_SEM_ATIVACAO = new Set([7]);
const TENANT_PRODUTOS = {
  2:  { produtos: ['jogo'], status: 'ativo' },
  42: { produtos: ['jogo'], status: 'ativo' },
  43: { produtos: ['jogo'], status: 'trial' },
  44: { produtos: ['jogo'], status: 'trial' },
  45: { produtos: ['vitrine', 'jogo'], status: 'ativo' },
};
// Nomes de chave que indicam vitrine quando o tenant roda os dois produtos (só tenant 45
// hoje) — resto cai em jogo por eliminação.
const NOME_INDICA_VITRINE = /produtos|vitrine|totem/i;

async function resetSequence(table) {
  await core.raw(
    `SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ??), 1))`,
    [table, table]
  );
}

async function copyTenants() {
  const tenants = await mydb('tenants').select('id', 'nome', 'slug', 'logo_url', 'cor_primaria', 'ativo', 'created_at');
  for (const t of tenants) {
    await core('tenants').insert(t).onConflict('id').merge();
  }
  console.log(`tenants: ${tenants.length} copiados`);
  return tenants;
}

async function copyUsers() {
  const users = await mydb('users').select('id', 'nome', 'email', 'senha', 'role', 'tenant_id', 'ativo', 'created_at');
  for (const u of users) {
    await core('users').insert(u).onConflict('id').merge();
  }
  console.log(`users: ${users.length} copiados`);
}

async function copyEventos() {
  const eventos = await mydb('eventos').select('id', 'tenant_id', 'nome', 'descricao', 'data_inicio', 'data_fim', 'status', 'created_by', 'created_at');
  for (const e of eventos) {
    await core('eventos').insert({ ...e, local: null, origem: 'interno' }).onConflict('id').merge();
  }
  console.log(`eventos: ${eventos.length} copiados`);
  return eventos;
}

async function seedProdutos() {
  const produtos = [
    { slug: 'salve', nome: 'Salve', surface: null, dominio: 'mandasalve.com', ativo: true },
    { slug: 'vitrine', nome: 'Vitrine', surface: 'vitrine', dominio: null, ativo: true },
    { slug: 'jogo', nome: 'Jogo', surface: 'jogo', dominio: null, ativo: true },
  ];
  for (const p of produtos) {
    await core('produtos').insert(p).onConflict('slug').merge();
  }
  const rows = await core('produtos').select('id', 'slug');
  console.log(`produtos: ${rows.length} semeados`);
  return Object.fromEntries(rows.map((r) => [r.slug, r.id]));
}

async function inferTenantProdutos(produtoIdBySlug) {
  // tenant_id:produto_slug -> tenant_produtos.id, usado depois em buildAtivacoes()
  const tenantProdutoIdMap = {};
  for (const [tenantIdStr, { produtos, status }] of Object.entries(TENANT_PRODUTOS)) {
    const tenantId = Number(tenantIdStr);
    const tenant = await core('tenants').where({ id: tenantId }).first();
    for (const produtoSlug of produtos) {
      const produtoId = produtoIdBySlug[produtoSlug];
      let row = await core('tenant_produtos').where({ tenant_id: tenantId, produto_id: produtoId }).first();
      if (!row) {
        [row] = await core('tenant_produtos').insert({
          tenant_id: tenantId,
          produto_id: produtoId,
          plano: 'legado',
          valor_centavos: 0,
          ciclo: 'mensal',
          status,
          data_inicio: tenant.created_at,
          data_fim: null,
          config: {},
        }).returning('*');
      }
      tenantProdutoIdMap[`${tenantId}:${produtoSlug}`] = row.id;
    }
  }
  console.log(`tenant_produtos: ${Object.keys(tenantProdutoIdMap).length} linhas garantidas`);
  return tenantProdutoIdMap;
}

async function buildAtivacoes(eventos, produtoIdBySlug, tenantProdutoIdMap) {
  // evento_id:produto_slug -> ativacoes.id, usado depois em copyApiKeys()
  const ativacaoIdMap = {};
  for (const evento of eventos) {
    if (EVENTO_IDS_SEM_ATIVACAO.has(evento.id)) continue;

    const tenantConfig = TENANT_PRODUTOS[evento.tenant_id];
    if (!tenantConfig) continue; // tenant sem sinal de produto nenhum — nada a criar

    for (const produtoSlug of tenantConfig.produtos) {
      const produtoId = produtoIdBySlug[produtoSlug];
      let config = {};
      if (produtoSlug === 'jogo') {
        const tenantRow = await mydb('tenants').where({ id: evento.tenant_id }).select('game_url', 'game_credentials').first();
        config = { game_url: tenantRow.game_url, game_credentials: tenantRow.game_credentials };
      }

      let row = await core('ativacoes').where({ evento_id: evento.id, produto_id: produtoId }).first();
      if (!row) {
        [row] = await core('ativacoes').insert({
          evento_id: evento.id,
          produto_id: produtoId,
          tenant_produto_id: tenantProdutoIdMap[`${evento.tenant_id}:${produtoSlug}`] ?? null,
          nome: `${evento.nome} — ${produtoSlug}`,
          data_inicio: evento.data_inicio,
          data_fim: evento.data_fim,
          status: 'agendado',
          config,
          metricas: {},
        }).returning('*');
      }
      ativacaoIdMap[`${evento.id}:${produtoSlug}`] = row.id;
    }
  }
  console.log(`ativacoes: ${Object.keys(ativacaoIdMap).length} garantidas`);
  return ativacaoIdMap;
}

function resolveProdutoSlugDaChave(key, evento) {
  const tenantConfig = TENANT_PRODUTOS[evento.tenant_id];
  if (!tenantConfig) return null;
  if (tenantConfig.produtos.length === 1) return tenantConfig.produtos[0];
  // Tenant roda mais de um produto (só tenant 45 hoje) — desambigua pelo nome da chave.
  return NOME_INDICA_VITRINE.test(key.nome) ? 'vitrine' : 'jogo';
}

async function copyApiKeys(eventosById, ativacaoIdMap) {
  const keys = await mydb('basic_auth_keys').select('id', 'nome', 'token_hash', 'ativo', 'created_by', 'evento_id', 'created_at');
  let semAtivacao = 0;
  for (const key of keys) {
    let ativacaoId = null;
    if (key.evento_id && !EVENTO_IDS_SEM_ATIVACAO.has(key.evento_id)) {
      const evento = eventosById[key.evento_id];
      const produtoSlug = evento ? resolveProdutoSlugDaChave(key, evento) : null;
      ativacaoId = produtoSlug ? (ativacaoIdMap[`${key.evento_id}:${produtoSlug}`] ?? null) : null;
    }
    if (!ativacaoId) semAtivacao += 1;

    await core('api_keys').insert({
      id: key.id,
      nome: key.nome,
      token_hash: key.token_hash,
      ativo: key.ativo,
      created_by: key.created_by,
      ativacao_id: ativacaoId,
      created_at: key.created_at,
    }).onConflict('id').merge();
  }
  console.log(`api_keys: ${keys.length} copiadas (${semAtivacao} sem ativacao_id — esperado pras chaves 8,10,11,16,17,18)`);
}

async function main() {
  const tenants = await copyTenants();
  await copyUsers();
  const eventos = await copyEventos();
  const eventosById = Object.fromEntries(eventos.map((e) => [e.id, e]));

  const produtoIdBySlug = await seedProdutos();
  const tenantProdutoIdMap = await inferTenantProdutos(produtoIdBySlug);
  const ativacaoIdMap = await buildAtivacoes(eventos, produtoIdBySlug, tenantProdutoIdMap);
  await copyApiKeys(eventosById, ativacaoIdMap);

  for (const table of ['tenants', 'users', 'eventos', 'api_keys']) {
    await resetSequence(table);
  }

  console.log('\nResumo final:');
  for (const table of ['tenants', 'users', 'eventos', 'produtos', 'tenant_produtos', 'ativacoes', 'api_keys']) {
    const [{ count }] = await core(table).count('id');
    console.log(`  ${table}: ${count}`);
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await mydb.destroy(); await core.destroy(); });
