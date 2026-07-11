exports.up = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.string('url_ficha', 500);
  });
};

exports.down = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.dropColumn('url_ficha');
  });
};
