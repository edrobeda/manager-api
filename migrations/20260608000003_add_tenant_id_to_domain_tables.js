exports.up = async function(knex) {
  await knex.schema.table('clientes', (table) => {
    table.integer('tenant_id').unsigned().references('id').inTable('tenants');
  });
  await knex.schema.table('premios', (table) => {
    table.integer('tenant_id').unsigned().references('id').inTable('tenants');
  });
  await knex.schema.table('quiz', (table) => {
    table.integer('tenant_id').unsigned().references('id').inTable('tenants');
  });
  await knex.schema.table('partidas', (table) => {
    table.integer('tenant_id').unsigned().references('id').inTable('tenants');
  });
};

exports.down = async function(knex) {
  await knex.schema.table('partidas', (table) => { table.dropColumn('tenant_id'); });
  await knex.schema.table('quiz',     (table) => { table.dropColumn('tenant_id'); });
  await knex.schema.table('premios',  (table) => { table.dropColumn('tenant_id'); });
  await knex.schema.table('clientes', (table) => { table.dropColumn('tenant_id'); });
};
