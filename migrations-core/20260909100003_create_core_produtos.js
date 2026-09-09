exports.up = function(knex) {
  return knex.schema.createTable('produtos', (t) => {
    t.increments('id').primary();
    t.string('slug', 50).notNullable().unique();
    t.string('nome', 100).notNullable();
    t.string('surface', 50);
    t.string('dominio', 255);
    t.boolean('ativo').notNullable().defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('produtos');
};
