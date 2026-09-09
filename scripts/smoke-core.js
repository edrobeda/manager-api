// Smoke test simples pros 3 endpoints novos da Fase 0 (sem framework de teste novo —
// repo não tem nenhum hoje). Roda contra uma instância já de pé.
// Uso: BASE_URL=http://localhost:3004 CORE_SERVICE_TOKEN=... TOTEM_TOKEN=... npm run test:core
const assert = require('node:assert/strict');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3004';
const CORE_SERVICE_TOKEN = process.env.CORE_SERVICE_TOKEN || 'core-service-secret-change-me';
const TOTEM_TOKEN = process.env.TOTEM_TOKEN;

async function main() {
  const headers = { Authorization: `Bearer ${CORE_SERVICE_TOKEN}`, 'Content-Type': 'application/json' };

  // Sem token de serviço → 401
  const semAuth = await fetch(`${BASE_URL}/api/ctx/resolve?tenant=x&evento=1&produto=jogo`);
  assert.equal(semAuth.status, 401, 'ctx/resolve sem Authorization deveria dar 401');

  // ctx/resolve — tenant vetnil-pet, evento 6, produto vitrine
  const ctxRes = await fetch(`${BASE_URL}/api/ctx/resolve?tenant=vetnil-pet&evento=6&produto=vitrine`, { headers });
  assert.equal(ctxRes.status, 200, 'ctx/resolve deveria retornar 200 pra vetnil-pet/6/vitrine');
  const ctx = await ctxRes.json();
  assert.equal(ctx.tenant_slug, 'vetnil-pet');
  assert.equal(ctx.produto.slug, 'vitrine');
  assert.ok(ctx.ativacao, 'ativação deveria existir pra evento 6 + vitrine');
  console.log('OK ctx/resolve:', ctx);

  // webhooks/subscribe — stub
  const webhookRes = await fetch(`${BASE_URL}/api/webhooks/subscribe`, {
    method: 'POST', headers, body: JSON.stringify({ produto: 'vitrine', url: 'http://example.com' }),
  });
  assert.equal(webhookRes.status, 200);
  console.log('OK webhooks/subscribe');

  // keys/validate — só roda de ponta a ponta se TOTEM_TOKEN foi passado (token real de produção)
  if (TOTEM_TOKEN) {
    const keyRes = await fetch(`${BASE_URL}/api/keys/validate`, {
      method: 'POST', headers, body: JSON.stringify({ token: TOTEM_TOKEN }),
    });
    assert.equal(keyRes.status, 200, 'keys/validate deveria aceitar o token real do totem');
    const key = await keyRes.json();
    assert.equal(key.produto, 'vitrine');
    assert.equal(key.tenant_id, 45);
    console.log('OK keys/validate:', key);
  } else {
    console.log('SKIP keys/validate (defina TOTEM_TOKEN pra rodar essa checagem)');
  }

  console.log('\nSmoke test da Fase 0 passou.');
}

main().catch((err) => { console.error('FALHOU:', err.message); process.exitCode = 1; });
