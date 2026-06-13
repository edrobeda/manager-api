exports.up = function(knex) {
  return knex.schema.createTable('tenants', (table) => {
    table.increments('id').primary();
    table.string('nome', 255).notNullable();
    table.string('slug', 100).notNullable().unique();
    table.text('logo_url');
    table.string('cor_primaria', 7).defaultTo('#10b981');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tenants');
};
