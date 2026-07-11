exports.up = function(knex) {
  return knex.schema.createTable('config_totem', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('config_slug', 100).notNullable();
    t.string('valor', 50).notNullable();
    t.string('tipo', 20).notNullable();
    t.boolean('ativo').notNullable().defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());

    t.unique(['tenant_id', 'config_slug']);
    t.index('tenant_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('config_totem');
};
