exports.up = function(knex) {
  return knex.schema.createTable('clientes', (t) => {
    t.increments('id').primary();
    t.string('nome', 255).notNullable();
    t.string('cpf', 60).notNullable();
    t.string('email', 255).notNullable();
    t.string('perfil', 100).notNullable();
    t.timestamp('criado_em', { useTz: false }).defaultTo(knex.fn.now());
    t.string('telefone', 30);
    t.integer('tenant_id');
    t.boolean('aceita_marketing').notNullable().defaultTo(false);
    t.boolean('archived').notNullable().defaultTo(false);
    t.integer('ativacao_id');

    // Dedupe continua por tenant (não por ativação) — mesmo comportamento de hoje.
    t.unique(['cpf', 'tenant_id'], { predicate: knex.whereRaw('NOT archived') });
    t.unique(['email', 'tenant_id'], { predicate: knex.whereRaw("NOT archived AND email IS NOT NULL AND email <> ''") });
    t.unique(['telefone', 'tenant_id'], { predicate: knex.whereRaw("NOT archived AND telefone IS NOT NULL AND telefone <> ''") });
    t.index('tenant_id');
    t.index('ativacao_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('clientes');
};
