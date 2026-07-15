const crypto = require('crypto');

function gerarCodigo() {
  return crypto.randomBytes(5).toString('base64url');
}

module.exports = { gerarCodigo };
