exports.up = function(knex) {
  return knex.schema.table('tenants', (t) => {
    t.jsonb('game_credentials');
  });
};

exports.down = function(knex) {
  return knex.schema.table('tenants', (t) => {
    t.dropColumn('game_credentials');
  });
};
