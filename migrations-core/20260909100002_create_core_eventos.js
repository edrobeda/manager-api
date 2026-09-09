exports.up = function(knex) {
  return knex.schema.createTable('eventos', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('nome', 255).notNullable();
    t.text('descricao');
    t.timestamp('data_inicio').notNullable();
    t.timestamp('data_fim').notNullable();
    t.string('status', 20).notNullable().defaultTo('agendado');
    t.jsonb('local');
    t.string('origem', 20).notNullable().defaultTo('interno');
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.index('tenant_id');
    t.index('status');
    t.index('data_fim');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('eventos');
};
