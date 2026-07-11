exports.up = function(knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.jsonb('game_credentials').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('game_credentials');
  });
};
