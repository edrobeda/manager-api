// Catálogo reutilizável por tenant (confirmado: em mydb, evento_id sempre NULL nas 53
// linhas hoje, apesar da coluna existir) — por isso essa versão não tem ativacao_id nem
// evento_id, só tenant_id. Ver decisão na Fase 1 do ROADMAP.md.
exports.up = function(knex) {
  return knex.schema.createTable('produtos_totem', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable();
    t.string('slug', 255).notNullable();
    t.string('linha', 255).notNullable();
    t.string('descricao_curta', 500);
    t.text('descricao');
    t.string('imagem_produto_url', 500);
    t.string('imagem_banner_url', 500);
    t.string('video_url', 500);
    t.string('video_local_url', 500);
    t.jsonb('extras').notNullable().defaultTo('{}');
    t.integer('ordem').notNullable().defaultTo(0);
    t.boolean('ativo').notNullable().defaultTo(true);
    t.string('nome', 255).notNullable().defaultTo('');
    t.string('lang', 10).notNullable().defaultTo('pt');
    t.boolean('destaque').notNullable().defaultTo(false);
    t.string('serie', 255);
    t.string('url_ficha', 500);
    t.boolean('banner_institucional').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());

    t.unique(['tenant_id', 'slug', 'lang']);
    t.index('tenant_id');
    t.index('ativo');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('produtos_totem');
};
