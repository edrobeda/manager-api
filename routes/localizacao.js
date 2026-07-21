const router = require('express').Router();
const db = require('../db');

// Formata uma linha { id, nome, estado_sigla, estado_nome } conforme o parâmetro `formato`.
function formatarCidade(row, formato) {
  if (formato === 'simples') return `${row.nome} - ${row.estado_sigla}`;
  if (formato === 'label') {
    return { id: row.id, label: `${row.nome} - ${row.estado_sigla}` };
  }
  return {
    id: row.id,
    cidade: row.nome,
    estado: row.estado_nome,
    uf: row.estado_sigla,
  };
}

// GET /api/estados — lista todos os estados, ordenados por nome
router.get('/estados', async (req, res) => {
  try {
    const estados = await db('estados').select('sigla', 'nome').orderBy('nome', 'asc');
    res.json({ success: true, estados });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cidades — lista cidades, com filtro/ordenação/formato opcionais
// Query params:
//   estado   — filtra por UF (ex: SP)
//   busca    — filtra por nome (contém, case-insensitive)
//   ordenar  — 'cidade' (padrão, alfabética) | 'estado' (agrupada por estado, depois cidade)
//   formato  — 'objeto' (padrão, { id, cidade, estado, uf }) | 'label' ({ id, label: "Cidade - UF" }) | 'simples' ("Cidade - UF")
router.get('/cidades', async (req, res) => {
  try {
    const { estado, busca, ordenar = 'cidade', formato = 'objeto' } = req.query;

    let query = db('cidades as c')
      .join('estados as e', 'e.sigla', 'c.estado_sigla')
      .select('c.id', 'c.nome', 'c.estado_sigla', 'e.nome as estado_nome');

    if (estado) query = query.where('c.estado_sigla', estado.toUpperCase());
    if (busca) query = query.whereILike('c.nome', `%${busca}%`);

    query = ordenar === 'estado'
      ? query.orderBy('e.nome', 'asc').orderBy('c.nome', 'asc')
      : query.orderBy('c.nome', 'asc');

    const rows = await query;
    const cidades = rows.map((r) => formatarCidade(r, formato));

    res.json({ success: true, total: cidades.length, cidades });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
