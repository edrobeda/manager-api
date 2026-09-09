// evento_id vira ativacao_id (+ tenant_id denormalizado).
exports.up = function(knex) {
  return knex.schema.createTable('acessos', (t) => {
    t.increments('id').primary();
    t.integer('ativacao_id');
    t.integer('tenant_id');
    t.string('tipo', 20).notNullable();
    t.string('referencia', 500).notNullable();
    t.integer('short_link_id').references('id').inTable('short_links').onDelete('SET NULL');
    t.timestamp('criado_em').defaultTo(knex.fn.now());
    t.integer('duracao_segundos');
    t.string('totem_id', 36);

    t.index('ativacao_id');
    t.index('criado_em');
    t.index('totem_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('acessos');
};
