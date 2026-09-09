// Smoke test do backend Vitrine multitenant (Fase 2). Mesmo espírito do
// scripts/smoke-core.js — sem framework novo, roda contra uma instância já de pé.
// Uso: BASE_URL=http://localhost:3004 TOTEM_TOKEN=... node scripts/smoke-vitrine.js
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3004';
const TOTEM_TOKEN = process.env.TOTEM_TOKEN;

async function main() {
  if (!TOTEM_TOKEN) {
    console.log('SKIP smoke-vitrine (defina TOTEM_TOKEN — token real de uma chave vinculada a uma ativação de vitrine)');
    return;
  }
  const auth = { Authorization: `Basic ${Buffer.from(`x:${TOTEM_TOKEN}`).toString('base64')}` };

  const semAuth = await fetch(`${BASE_URL}/api/vitrine-app/produtos`);
  assert.equal(semAuth.status, 401, 'produtos sem Authorization deveria dar 401');

  const produtosRes = await fetch(`${BASE_URL}/api/vitrine-app/produtos?lang=pt`, { headers: auth });
  assert.equal(produtosRes.status, 200);
  const { produtos } = await produtosRes.json();
  assert.ok(Array.isArray(produtos) && produtos.length > 0, 'esperava ao menos 1 produto');
  assert.ok(produtos[0].url_ficha?.includes('/r-vitrine/'), 'url_ficha deveria virar link curto /r-vitrine/...');
  console.log(`OK produtos: ${produtos.length}`);

  const slug = produtos[0].slug;
  const produtoRes = await fetch(`${BASE_URL}/api/vitrine-app/produtos/${slug}?lang=pt`, { headers: auth });
  assert.equal(produtoRes.status, 200);
  console.log('OK produtos/:slug');

  const configRes = await fetch(`${BASE_URL}/api/vitrine-app/configuracoes`, { headers: auth });
  assert.equal(configRes.status, 200);
  console.log('OK configuracoes');

  const acessoRes = await fetch(`${BASE_URL}/api/vitrine-app/acessos`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'pagina', referencia: '/produto/smoke-test' }),
  });
  assert.equal(acessoRes.status, 201);
  console.log('OK acessos (POST)');

  console.log('\nSmoke test do backend Vitrine passou.');
}

main().catch((err) => { console.error('FALHOU:', err.message); process.exitCode = 1; });
