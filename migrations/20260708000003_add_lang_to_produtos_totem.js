exports.up = async function(knex) {
  await knex.schema.table('produtos_totem', (t) => {
    t.string('lang', 2).notNullable().defaultTo('pt');
  });
  await knex.schema.alterTable('produtos_totem', (t) => {
    t.dropUnique(['tenant_id', 'slug']);
    t.unique(['tenant_id', 'slug', 'lang']);
  });
};

exports.down = async function(knex) {
  await knex.schema.alterTable('produtos_totem', (t) => {
    t.dropUnique(['tenant_id', 'slug', 'lang']);
    t.unique(['tenant_id', 'slug']);
  });
  await knex.schema.table('produtos_totem', (t) => {
    t.dropColumn('lang');
  });
};
