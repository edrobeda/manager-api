exports.up = function(knex) {
  return knex.schema.createTable('basic_auth_keys', (t) => {
    t.increments('id');
    t.string('nome', 100).notNullable();
    t.string('token_hash', 64).notNullable().unique();
    t.boolean('ativo').notNullable().defaultTo(true);
    t.integer('created_by').unsigned().references('id').inTable('users').onDelete('SET NULL');
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('basic_auth_keys');
};
