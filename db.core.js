const knex = require('knex');
const knexConfig = require('./knexfile.core');
module.exports = knex(knexConfig.development);
