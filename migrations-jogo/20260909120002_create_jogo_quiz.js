// Catálogo reutilizável do tenant — mesma lógica de premios/produtos_totem, sem ativacao_id.
exports.up = function(knex) {
  return knex.schema.createTable('quiz', (t) => {
    t.increments('id').primary();
    t.text('pergunta').notNullable();
    t.text('primeira').notNullable();
    t.text('segunda').notNullable();
    t.text('terceira');
    t.text('quarta');
    t.integer('correta').notNullable();
    t.boolean('ativo').defaultTo(true);
    t.text('ultima_resposta');
    t.integer('tenant_id');
    t.text('imagem_overlay');

    t.index('tenant_id');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('quiz');
};
