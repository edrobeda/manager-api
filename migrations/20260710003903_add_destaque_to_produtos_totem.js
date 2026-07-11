exports.up = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.boolean('destaque').notNullable().defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.dropColumn('destaque');
  });
};
