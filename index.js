require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const auth = require('./middleware/basicAuth');

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
// Cidades/estados (IBGE) — dado de referência público, sem tenant, pra qualquer
// formulário (ex: cadastro de um game) usar direto sem precisar de chave de API
app.use('/api', require('./routes/localizacao'));

// Rotas protegidas
app.use('/api/backups',     auth, require('./routes/backups'));
app.use('/api/webs',        auth, require('./routes/webs'));
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
app.use('/api/config-totem', auth, require('./routes/configTotem'));
app.use('/api/totem',       auth, require('./routes/totemPublic'));
app.use('/api/short-links', auth, require('./routes/shortLinks'));
app.use('/api/acessos',     auth, require('./routes/acessos'));

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Manager API rodando na porta ${PORT}`));
