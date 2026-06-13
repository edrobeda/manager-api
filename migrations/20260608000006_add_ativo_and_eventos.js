exports.up = async (knex) => {
  // ativo em users
  await knex.schema.table('users', (t) => {
    t.boolean('ativo').notNullable().defaultTo(true);
  });

  // ativo em tenants
  await knex.schema.table('tenants', (t) => {
    t.boolean('ativo').notNullable().defaultTo(true);
  });

  // tabela de eventos (sessões de jogo agendadas)
  await knex.schema.createTable('eventos', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('nome', 255).notNullable();
    t.text('descricao');
    t.timestamp('data_inicio').notNullable();
    t.timestamp('data_fim').notNullable();
    // agendado | ativo | encerrado | cancelado
    t.string('status', 20).notNullable().defaultTo('agendado');
    t.integer('created_by').references('id').inTable('users');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.index('tenant_id');
    t.index('status');
    t.index('data_fim');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists('eventos');
  await knex.schema.table('tenants', (t) => t.dropColumn('ativo'));
  await knex.schema.table('users', (t) => t.dropColumn('ativo'));
};
