// Helper compartilhado entre routes/ctx.js#provisionar (produto se
// auto-provisionando via service token) e routes/core.js (staff criando
// contrato "uso livre" manualmente) — ver ROADMAP.md, Fase 5 e o fluxo de
// staff fechado depois dela.
//
// "Uso livre" = ativação sem evento real por trás (produto sem conceito de
// evento, ou contrato que não quer amarrar numa data). Como `ativacoes.evento_id`
// é NOT NULL no schema do core, resolve criando um evento sintético "sempre
// ativo" (agora até +10 anos) — mesmo truque já usado no provisionamento do
// salve, só que agora extraído pra não duplicar a lógica numa segunda rota.

const DEZ_ANOS_MS = 10 * 365 * 24 * 60 * 60 * 1000;

// Cria o evento sintético "sempre ativo" + a ativação vinculada.
//
// `dataInicioEvento`/`dataFimEvento` (opcionais) deixam quem chama (ex. o salve,
// via /api/ctx/provisionar) passar uma janela própria quando tiver uma — sem
// elas, cai no default "sempre ativo" (agora até +10 anos).
//
// `dataFimAtivacao` (opcional, independente da janela do evento) é o que de
// fato limita um contrato trial — a ativação tem prioridade sobre o evento em
// utils/calcStatus.js (`ativacao.data_fim ?? evento.data_fim`), então dá pra
// ter o evento sempre "aberto" e só a ativação expirando no trial.
async function criarAtivacaoUsoLivre(dbCore, {
  tenantId, produtoId, tenantProdutoId, nome,
  dataInicioEvento, dataFimEvento, dataFimAtivacao,
}) {
  const agora = new Date();
  const fimDefault = new Date(agora.getTime() + DEZ_ANOS_MS);

  const [evento] = await dbCore('eventos')
    .insert({
      tenant_id: tenantId,
      nome: nome || 'Uso livre',
      data_inicio: dataInicioEvento ?? agora.toISOString(),
      data_fim: dataFimEvento ?? fimDefault.toISOString(),
      origem: 'cliente',
      status: 'ativo',
    })
    .returning('*');

  const [ativacao] = await dbCore('ativacoes')
    .insert({
      evento_id: evento.id,
      produto_id: produtoId,
      tenant_produto_id: tenantProdutoId ?? null,
      status: 'ativo',
      data_fim: dataFimAtivacao ?? null,
    })
    .returning('*');

  return { evento, ativacao };
}

module.exports = { criarAtivacaoUsoLivre };
