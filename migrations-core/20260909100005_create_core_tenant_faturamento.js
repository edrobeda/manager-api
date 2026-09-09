exports.up = function(knex) {
  return knex.schema.createTable('tenant_faturamento', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('razao_social', 255);
    t.string('documento', 20);
    t.string('ie', 20);
    t.jsonb('endereco');
    t.string('contato_financeiro_nome', 255);
    t.string('contato_financeiro_email', 255);
    t.string('contato_financeiro_telefone', 30);
    t.string('email_nota_fiscal', 255);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('tenant_faturamento');
};
