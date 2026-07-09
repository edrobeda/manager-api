exports.up = function(knex) {
  return knex.schema.createTable('produtos_totem', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.integer('evento_id').references('id').inTable('eventos').onDelete('SET NULL');
    t.string('slug', 255).notNullable();
    t.string('linha', 255).notNullable();
    t.string('descricao_curta', 500);
    t.text('descricao');
    t.string('imagem_produto_url', 500);
    t.string('imagem_banner_url', 500);
    t.string('video_url', 500);
    t.jsonb('extras').notNullable().defaultTo('{}');
    t.integer('ordem').notNullable().defaultTo(0);
    t.boolean('ativo').notNullable().defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());

    t.unique(['tenant_id', 'slug']);
    t.index('tenant_id');
    t.index('evento_id');
    t.index('ativo');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('produtos_totem');
};
