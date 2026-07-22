exports.up = function(knex) {
  return knex.schema.alterTable('acessos', (t) => {
    t.string('totem_id', 36).nullable();
    t.index('totem_id');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('acessos', (t) => {
    t.dropColumn('totem_id');
  });
};
