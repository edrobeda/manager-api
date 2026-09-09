exports.up = function(knex) {
  return knex.schema.createTable('partidas', (t) => {
    t.increments('id').primary();
    t.integer('cliente_id').notNullable().references('id').inTable('clientes');
    t.integer('quiz_acertos').notNullable().defaultTo(0);
    t.integer('premio_id').references('id').inTable('premios');
    t.boolean('email_enviado').defaultTo(false);
    t.timestamp('jogado_em', { useTz: false }).defaultTo(knex.fn.now());
    t.string('codigo', 20).unique();
    t.string('status', 30).defaultTo('jogando');
    t.timestamp('entregue_em', { useTz: false });
    t.string('operador', 100);
    t.integer('tenant_id');
    t.jsonb('params');
    t.integer('tempo_ms');
    t.integer('ativacao_id');

    t.index('tenant_id');
    t.index('ativacao_id');
  })
    .then(() => knex.raw(
      'CREATE INDEX idx_partidas_leaderboard ON partidas (tenant_id, quiz_acertos, tempo_ms) WHERE tempo_ms IS NOT NULL'
    ));
};

exports.down = function(knex) {
  return knex.schema.dropTable('partidas');
};
