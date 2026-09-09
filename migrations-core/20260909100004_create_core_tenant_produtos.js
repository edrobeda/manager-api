exports.up = function(knex) {
  return knex.schema.createTable('tenant_produtos', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.integer('produto_id').notNullable().references('id').inTable('produtos').onDelete('CASCADE');
    t.string('plano', 50).notNullable().defaultTo('legado');
    t.integer('valor_centavos').notNullable().defaultTo(0);
    t.string('ciclo', 20).notNullable().defaultTo('mensal');
    t.string('status', 20).notNullable().defaultTo('ativo');
    t.date('data_inicio');
    t.date('data_fim');
    t.jsonb('config').notNullable().defaultTo('{}');
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.index('tenant_id');
    t.index('produto_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tenant_produtos');
};
