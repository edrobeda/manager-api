exports.up = function(knex) {
  return knex.schema.createTable('short_links', (t) => {
    t.increments('id').primary();
    t.string('codigo', 20).notNullable();
    t.text('url_destino').notNullable();
    t.integer('evento_id').nullable().references('id').inTable('eventos').onDelete('CASCADE');
    t.timestamp('criado_em').defaultTo(knex.fn.now());

    t.unique('codigo');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('short_links');
};
