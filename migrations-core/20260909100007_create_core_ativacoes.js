exports.up = function(knex) {
  return knex.schema.createTable('ativacoes', (t) => {
    t.increments('id').primary();
    t.integer('evento_id').notNullable().references('id').inTable('eventos').onDelete('CASCADE');
    t.integer('produto_id').notNullable().references('id').inTable('produtos').onDelete('CASCADE');
    t.integer('tenant_produto_id').references('id').inTable('tenant_produtos').onDelete('SET NULL');
    t.string('nome', 255);
    t.timestamp('data_inicio');
    t.timestamp('data_fim');
    t.string('status', 20).notNullable().defaultTo('agendado');
    t.jsonb('config').notNullable().defaultTo('{}');
    t.jsonb('metricas').notNullable().defaultTo('{}');
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.unique(['evento_id', 'produto_id']);
    t.index('produto_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('ativacoes');
};
