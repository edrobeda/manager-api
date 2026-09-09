exports.up = function(knex) {
  return knex.schema.createTable('faturas', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.integer('tenant_produto_id').references('id').inTable('tenant_produtos').onDelete('SET NULL');
    t.string('competencia', 7); // 'YYYY-MM'
    t.integer('valor_centavos').notNullable().defaultTo(0);
    t.date('vencimento');
    t.string('status', 20).notNullable().defaultTo('aberta');
    t.string('gateway', 30);
    t.string('gateway_id', 100);
    t.text('link_pagamento');
    t.timestamp('pago_em');
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.index('tenant_id');
    t.index('status');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('faturas');
};
