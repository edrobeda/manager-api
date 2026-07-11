exports.up = function(knex) {
  return knex.schema.alterTable('config_totem', (t) => {
    t.text('valor').notNullable().alter();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('config_totem', (t) => {
    t.string('valor', 500).notNullable().alter();
  });
};
