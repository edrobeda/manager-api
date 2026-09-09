// Catálogo reutilizável do tenant (sem referência a evento hoje) — sem ativacao_id,
// mesma lógica de produtos_totem no banco vitrine.
exports.up = function(knex) {
  return knex.schema.createTable('premios', (t) => {
    t.increments('id').primary();
    t.string('nome', 255).notNullable();
    t.string('subnome', 255);
    t.integer('chance');
    t.boolean('ativo').defaultTo(true);
    t.integer('quantidade');
    t.integer('tenant_id');
    t.integer('tier');
    t.integer('ordem');
    t.string('descricao', 100);
    t.boolean('archived').notNullable().defaultTo(false);

    t.index('tenant_id');
    t.index(['tenant_id', 'tier', 'ordem']);
    t.check('chance >= 1 AND chance <= 6', [], 'premios_chance_check');
    t.check('ordem IS NULL OR (ordem >= 1 AND ordem <= 4)', [], 'premios_ordem_check');
    t.check('tier IS NULL OR (tier >= 0 AND tier <= 5)', [], 'premios_tier_check');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('premios');
};
