exports.up = function(knex) {
  return knex.schema.createTable('api_keys', (t) => {
    t.increments('id').primary();
    t.string('nome', 255).notNullable();
    t.string('token_hash', 64).notNullable().unique();
    t.boolean('ativo').notNullable().defaultTo(true);
    t.integer('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.integer('ativacao_id').references('id').inTable('ativacoes').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.index('ativacao_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('api_keys');
};
