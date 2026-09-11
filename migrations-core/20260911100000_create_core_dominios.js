// Fase 2 do ROADMAP.md — mapeia domínio público -> ativação, pra serviços externos
// (game-vetnil, game-vetnil-pet) resolverem tenant/ativação a partir do Host da
// request (X-Forwarded-Host do Caddy) em vez de token/tenant_id fixo no .env. Um
// mesmo jogo pode responder em mais de um domínio (canônico + alias legado) — cada um
// vira uma linha própria apontando pra mesma ativação. Ver routes/ctx.js#resolve-by-host.
exports.up = function(knex) {
  return knex.schema.createTable('dominios', (t) => {
    t.increments('id').primary();
    t.string('host', 255).notNullable().unique();
    t.integer('ativacao_id').notNullable().references('id').inTable('ativacoes').onDelete('CASCADE');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('dominios');
};
