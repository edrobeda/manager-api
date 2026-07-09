exports.up = function(knex) {
  return knex.schema.table('tenants', (t) => {
    t.string('game_url', 255);
  });
};

exports.down = function(knex) {
  return knex.schema.table('tenants', (t) => {
    t.dropColumn('game_url');
  });
};
