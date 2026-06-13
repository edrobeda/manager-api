exports.up = function(knex) {
  return knex.schema.alterTable('basic_auth_keys', (t) => {
    t.integer('evento_id').unsigned().nullable().references('id').inTable('eventos').onDelete('SET NULL');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('basic_auth_keys', (t) => {
    t.dropColumn('evento_id');
  });
};
