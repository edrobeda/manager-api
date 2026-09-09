// evento_id vira ativacao_id (+ tenant_id denormalizado, já que não há FK entre bancos).
exports.up = function(knex) {
  return knex.schema.createTable('short_links', (t) => {
    t.increments('id').primary();
    t.string('codigo', 20).notNullable().unique();
    t.text('url_destino').notNullable();
    t.integer('ativacao_id');
    t.integer('tenant_id');
    t.timestamp('criado_em').defaultTo(knex.fn.now());

    t.unique(['url_destino', 'ativacao_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('short_links');
};
