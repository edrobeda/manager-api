// Fase 6 do ROADMAP.md — lado emissor (core → Asaas). Cache do id de cliente
// criado no Asaas por tenant, pra não recriar o customer a cada fatura.
exports.up = function (knex) {
  return knex.schema.alterTable('tenant_faturamento', (t) => {
    t.string('asaas_customer_id', 60);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenant_faturamento', (t) => {
    t.dropColumn('asaas_customer_id');
  });
};
