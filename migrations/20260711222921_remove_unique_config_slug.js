exports.up = function(knex) {
  return knex.schema.alterTable('config_totem', (t) => {
    t.dropUnique(['tenant_id', 'config_slug']);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('config_totem', (t) => {
    t.unique(['tenant_id', 'config_slug']);
  });
};
