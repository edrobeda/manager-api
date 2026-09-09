// Mesma lógica já duplicada em routes/eventos.js e routes/game.js — extraída aqui só
// pras rotas novas do core (ctx.js, keys.js) reusarem, sem mexer nos arquivos existentes
// que servem produção (totem_vetnil, game).
function calcStatus(entidade, now = new Date()) {
  const inicio = new Date(entidade.data_inicio);
  const fim = new Date(entidade.data_fim);
  const amanha = new Date(now); amanha.setDate(amanha.getDate() + 1);

  if (now < inicio) return 'agendado';
  if (now > fim) return 'encerrado';
  if (fim <= amanha) return 'expirando';
  return 'ativo';
}

module.exports = { calcStatus };
