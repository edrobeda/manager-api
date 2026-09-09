const knex = require('knex');
const knexConfig = require('./knexfile.jogo');
module.exports = knex(knexConfig.development);
