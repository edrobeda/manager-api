exports.up = function(knex) {
  return knex.schema.createTable('config_totem', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable();
    t.string('config_slug', 100).notNullable();
    t.text('valor').notNullable();
    t.string('tipo', 20).notNullable();
    t.boolean('ativo').notNullable().defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());

    // Sem unique(tenant_id, config_slug): o mydb ao vivo não tem essa constraint (foi
    // removida em algum momento — há linhas duplicadas reais hoje, ex.: config_slug
    // 'data_analiticas' aceita 0..N linhas por tenant de propósito, ver totemPublic.js).
    t.index('tenant_id');
    t.index(['tenant_id', 'config_slug']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('config_totem');
};
