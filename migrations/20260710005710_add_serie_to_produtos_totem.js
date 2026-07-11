exports.up = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.string('serie', 255);
  });
};

exports.down = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.dropColumn('serie');
  });
};
