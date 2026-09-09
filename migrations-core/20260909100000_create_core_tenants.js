exports.up = function(knex) {
  return knex.schema.createTable('tenants', (t) => {
    t.increments('id').primary();
    t.string('nome', 255).notNullable();
    t.string('slug', 100).notNullable().unique();
    t.text('logo_url');
    t.string('cor_primaria', 7).defaultTo('#10b981');
    t.boolean('ativo').notNullable().defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tenants');
};
