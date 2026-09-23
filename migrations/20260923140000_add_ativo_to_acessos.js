exports.up = function(knex) {
  return knex.schema.alterTable('acessos', (t) => {
    t.boolean('ativo').notNullable().defaultTo(true);
    t.index('ativo');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('acessos', (t) => {
    t.dropColumn('ativo');
  });
};
