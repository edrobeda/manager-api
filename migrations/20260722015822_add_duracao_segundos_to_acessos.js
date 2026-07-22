exports.up = function(knex) {
  return knex.schema.alterTable('acessos', (t) => {
    t.integer('duracao_segundos').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('acessos', (t) => {
    t.dropColumn('duracao_segundos');
  });
};
