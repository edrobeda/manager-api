// Séries deixam de ser texto solto em produtos_totem.serie e passam a ser tabela própria,
// por tenant e com ordem controlável. A coluna 'serie' continua existindo e sincronizada
// com o nome da série: o totem em produção lê esse campo, e assim a API pode subir antes do front.
exports.up = async function (knex) {
  await knex.schema.createTable('series_totem', (t) => {
    t.increments('id').primary();
    t.integer('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    t.string('nome', 255).notNullable();
    t.integer('ordem').notNullable().defaultTo(0);
    t.boolean('ativo').notNullable().defaultTo(true);
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.timestamp('updated_at').defaultTo(knex.fn.now());

    t.unique(['tenant_id', 'nome']);
    t.index('tenant_id');
  });

  await knex.schema.table('produtos_totem', (t) => {
    t.integer('serie_id').references('id').inTable('series_totem').onDelete('SET NULL');
    t.index('serie_id');
  });

  const tenants = await knex('produtos_totem').distinct('tenant_id').pluck('tenant_id');

  for (const tenant_id of tenants) {
    // Coletado antes de qualquer update, senão a série criada para os produtos sem série
    // entraria nesta lista e viraria uma segunda série com o mesmo nome.
    const seriesExistentes = await knex('produtos_totem')
      .where({ tenant_id })
      .whereNotNull('serie')
      .groupBy('serie')
      .min('id as primeiro_id')
      .select('serie')
      .orderBy('primeiro_id');

    const semSerie = await knex('produtos_totem').where({ tenant_id }).whereNull('serie').first();

    let ordem = 0;

    // Produtos sem série viram a primeira seção, em vez do rótulo genérico "Outros" do totem
    if (semSerie) {
      const [serie] = await knex('series_totem')
        .insert({ tenant_id, nome: 'Outras Soluções Vetnil®', ordem })
        .returning('*');
      await knex('produtos_totem')
        .where({ tenant_id })
        .whereNull('serie')
        .update({ serie_id: serie.id, serie: serie.nome });
      ordem += 1;
    }

    for (const { serie: nome } of seriesExistentes) {
      const [serie] = await knex('series_totem')
        .insert({ tenant_id, nome, ordem })
        .returning('*');
      await knex('produtos_totem')
        .where({ tenant_id, serie: nome })
        .update({ serie_id: serie.id });
      ordem += 1;
    }
  }
};

exports.down = async function (knex) {
  await knex.schema.table('produtos_totem', (t) => {
    t.dropColumn('serie_id');
  });
  await knex.schema.dropTable('series_totem');
};
