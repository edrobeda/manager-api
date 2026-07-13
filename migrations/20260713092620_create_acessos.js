exports.up = function(knex) {
  return knex.schema.createTable('acessos', (t) => {
    t.increments('id').primary();
    t.integer('evento_id').nullable().references('id').inTable('eventos').onDelete('CASCADE');
    t.string('tipo', 20).notNullable(); // 'pagina' ou 'link_externo'
    t.string('referencia', 500).notNullable(); // path da rota, ou codigo do short link
    t.integer('short_link_id').nullable().references('id').inTable('short_links').onDelete('SET NULL');
    t.timestamp('criado_em').defaultTo(knex.fn.now());

    t.index('evento_id');
    t.index('criado_em');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('acessos');
};
