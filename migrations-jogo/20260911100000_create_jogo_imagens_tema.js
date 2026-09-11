// Fase 2 do ROADMAP.md — porta a tabela imagens_tema do game-vetnil-pet
// (server/db/migration_v6.sql) pro banco `jogo`. Catálogo reutilizável do tenant
// (imagens de fundo por tela), sem ativacao_id — mesma lógica de premios/quiz.
exports.up = function(knex) {
  return knex.schema.createTable('imagens_tema', (t) => {
    t.increments('id').primary();
    t.string('chave', 30).notNullable();
    t.text('caminho').notNullable();
    t.integer('tenant_id').notNullable().defaultTo(1);
    t.timestamp('atualizado_em', { useTz: false }).defaultTo(knex.fn.now());

    t.unique(['chave', 'tenant_id']);
    t.index('tenant_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('imagens_tema');
};
