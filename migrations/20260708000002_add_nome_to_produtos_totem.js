exports.up = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.string('nome', 255).notNullable().defaultTo('');
  });
};

exports.down = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.dropColumn('nome');
  });
};
