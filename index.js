require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const auth = require('./middleware/basicAuth');
const serviceAuth = require('./middleware/serviceAuth');
const vitrineDeviceAuth = require('./middleware/vitrineDeviceAuth');

const app = express();
app.use(cors());
// limite maior que o padrão (100kb) pra caber imagens embutidas em base64
// no conteúdo rico dos produtos do totem (ex.: campo "descricao")
app.use(express.json({ limit: '15mb' }));

// Rotas públicas
app.use('/api/auth', require('./routes/auth'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
// Imagens/vídeos de produtos do totem — públicos porque <img>/<video> não mandam header de Authorization.
// Path próprio (não é /api/uploads) porque essa rota já existe pra outra coisa (gestão de arquivos/backups)
app.use('/api/totem-uploads', express.static(path.join(__dirname, 'uploads')));
// Redirect de link curto — público porque quem escaneia o QR code não tem chave de API
app.use('/r', require('./routes/redirect'));
// Idem, mas pro app Vitrine multitenant novo (Fase 2, banco vitrine) — path próprio
// pra não colidir com /r/:codigo, que continua servindo os links antigos em mydb.
app.use('/r-vitrine', require('./routes/vitrineRedirect'));
// Cidades/estados (IBGE) — dado de referência público, sem tenant, pra qualquer
// formulário (ex: cadastro de um game) usar direto sem precisar de chave de API
app.use('/api', require('./routes/localizacao'));
// Linktree público (eventifylab.com/links, site estático em eventify-app) —
// fetch client-side sem chave de API, mesmo espírito de /api/estados acima
app.use('/api/links-public', require('./routes/linksPublic'));
// tracking de navegacao da pagina /links (visualizacao + clique em botao) —
// publico, mesmo espirito de links-public acima
app.use('/api/links-track', require('./routes/linksTrack'));

// Rotas protegidas
app.use('/api/backups',     auth, require('./routes/backups'));
app.use('/api/webs',        auth, require('./routes/webs'));
app.use('/api/links',       auth, require('./routes/links'));
app.use('/api/tenants',     auth, require('./routes/tenants'));
app.use('/api/quiz',        auth, require('./routes/quiz'));
app.use('/api/premios',     auth, require('./routes/premios'));
app.use('/api/clientes',    auth, require('./routes/clientes'));
app.use('/api/partidas',    auth, require('./routes/partidas'));
app.use('/api/eventos',     auth, require('./routes/eventos'));
app.use('/api/basic-auth',  auth, require('./routes/basicAuthKeys'));
app.use('/api/game',        auth, require('./routes/game'));
app.use('/api/uploads',     auth, require('./routes/uploads'));
app.use('/api/totem-uploads', auth, require('./routes/totemUploads'));
app.use('/api/produtos-totem', auth, require('./routes/produtosTotem'));
app.use('/api/series-totem', auth, require('./routes/seriesTotem'));
app.use('/api/config-totem', auth, require('./routes/configTotem'));
// O totem_vetnil sempre chamou /api/totem/acessos (BASE_URL do front é .../api/totem), mas essa rota só
// existia em /api/acessos — POST de página/vídeo assistido sempre deu 404 silencioso (catch vazio no front),
// nunca gravou nada (só o QR code, via /r/:codigo, é que gravava de verdade). Precisa vir antes do
// /api/totem geral, senão o totemPublic engole o path e nunca chega até aqui.
app.use('/api/totem/acessos', auth, require('./routes/acessos'));
app.use('/api/totem',       auth, require('./routes/totemPublic'));
app.use('/api/short-links', auth, require('./routes/shortLinks'));
app.use('/api/acessos',     auth, require('./routes/acessos'));

// Core de identidade (Fase 0 do ROADMAP.md) — lê/escreve só no banco eventifylab
// (db.core.js), nunca no mydb. Sem consumidor real ainda (Vitrine/Jogo nascem na Fase 2).
app.use('/api/ctx',      serviceAuth, require('./routes/ctx'));
app.use('/api/keys',     serviceAuth, require('./routes/keys'));
app.use('/api/webhooks', serviceAuth, require('./routes/webhooks'));
// Fase 5 do ROADMAP.md — produtos empurram métricas de uso da ativação (hoje sem
// consumidor real; salve vai usar quando a integração dele destravar, ver ROADMAP).
app.use('/api/uso',      serviceAuth, require('./routes/uso'));
// Fase 6 do ROADMAP.md — webhook de pagamento (Asaas → core). SEM serviceAuth: quem
// chama é o gateway externo, não um produto nosso — autenticação própria dentro da
// rota (ASAAS_WEBHOOK_TOKEN, ver routes/webhookAsaas.js). Path distinto de
// /api/webhooks pra não colidir com o middleware daquele (serviceAuth é pra
// core→produto, direção oposta).
app.use('/api/webhooks-asaas', require('./routes/webhookAsaas'));

// App Vitrine multitenant (Fase 2 do ROADMAP.md) — lê/escreve só no banco vitrine
// (db.vitrine.js), autenticado por chave de dispositivo resolvida via core
// (vitrineDeviceAuth.js), nunca no mydb. totem_vetnil continua em /api/totem (mydb),
// intocado — isto é um caminho paralelo, ainda sem consumidor real/cutover.
app.use('/api/vitrine-app', vitrineDeviceAuth, require('./routes/vitrineApp'));

// Portal do cliente (Fase 4 do ROADMAP.md) — self-service em {tenant}.eventifylab.com/admin.
// Lê/escreve só no banco eventifylab (db.core.js), sempre escopado por req.user.tenantId
// (sem bypass de superadmin — ver routes/portal/*.js). O JWT é o mesmo emitido por
// /api/auth/login pro staff, os tenant ids batem 1:1 entre mydb e eventifylab (seed da Fase 0).
app.use('/api/portal', auth, require('./routes/portal'));

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Manager API rodando na porta ${PORT}`));
