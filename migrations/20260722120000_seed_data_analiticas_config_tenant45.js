const VALORES = [
  '22/07/2026 08:00:00 - 22/07/2026 16:00:00',
  '23/07/2026 08:00:00 - 23/07/2026 16:00:00',
];

exports.up = function(knex) {
  return knex('config_totem').insert(
    VALORES.map((valor) => ({
      tenant_id: 45,
      config_slug: 'data_analiticas',
      valor,
      tipo: 'periodo',
      ativo: true,
    }))
  );
};

exports.down = function(knex) {
  return knex('config_totem')
    .where({ tenant_id: 45, config_slug: 'data_analiticas' })
    .whereIn('valor', VALORES)
    .delete();
};
