exports.up = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.string('video_local_url', 500);
  });
};

exports.down = function(knex) {
  return knex.schema.table('produtos_totem', (t) => {
    t.dropColumn('video_local_url');
  });
};
