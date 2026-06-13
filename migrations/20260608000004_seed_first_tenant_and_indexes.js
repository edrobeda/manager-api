exports.up = async function(knex) {
  // Inserir primeiro tenant
  await knex('tenants').insert({
    id: 1,
    nome: 'Eventify Lab',
    slug: 'eventifylab',
    cor_primaria: '#10b981',
  });

  // Associar todos os dados existentes ao tenant 1
  await knex('clientes').update({ tenant_id: 1 });
  await knex('premios').update({ tenant_id: 1 });
  await knex('quiz').update({ tenant_id: 1 });
  await knex('partidas').update({ tenant_id: 1 });

  // Índices para performance nas queries filtradas por tenant
  await knex.schema.raw('CREATE INDEX idx_clientes_tenant  ON clientes(tenant_id)');
  await knex.schema.raw('CREATE INDEX idx_premios_tenant   ON premios(tenant_id)');
  await knex.schema.raw('CREATE INDEX idx_quiz_tenant      ON quiz(tenant_id)');
  await knex.schema.raw('CREATE INDEX idx_partidas_tenant  ON partidas(tenant_id)');
};

exports.down = async function(knex) {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_partidas_tenant');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_quiz_tenant');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_premios_tenant');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_clientes_tenant');
  await knex('tenants').where({ id: 1 }).delete();
};
