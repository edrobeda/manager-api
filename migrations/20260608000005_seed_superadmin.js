const bcrypt = require('bcryptjs');

exports.up = async function(knex) {
  const senha = await bcrypt.hash('Admin@2026!', 10);
  await knex('users').insert({
    nome: 'Super Admin',
    email: 'admin@eventifylab.com',
    senha,
    role: 'superadmin',
    tenant_id: null,
  });
};

exports.down = async function(knex) {
  await knex('users').where({ email: 'admin@eventifylab.com' }).delete();
};
