exports.up = function(knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.string('game_url', 255).nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('game_url');
  });
};
