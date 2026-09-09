exports.up = function(knex) {
  return knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('nome', 255).notNullable();
    t.string('email', 255).notNullable().unique();
    t.string('senha', 255).notNullable();
    t.string('role', 20).notNullable().defaultTo('admin');
    t.integer('tenant_id').references('id').inTable('tenants').onDelete('CASCADE');
    t.boolean('ativo').notNullable().defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.index('tenant_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
