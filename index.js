require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const auth = require('./middleware/basicAuth');

const app = express();
app.use(cors());
app.use(express.json());

// Rotas públicas
app.use('/api/auth', require('./routes/auth'));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
// Imagens/vídeos de produtos do totem — públicos porque <img>/<video> não mandam header de Authorization.
// Path próprio (não é /api/uploads) porque essa rota já existe pra outra coisa (gestão de arquivos/backups)
app.use('/api/totem-uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/totem-uploads', auth, require('./routes/totemUploads'));
app.use('/api/produtos-totem', auth, require('./routes/produtosTotem'));
app.use('/api/config-totem', auth, require('./routes/configTotem'));
app.use('/api/totem',       auth, require('./routes/totemPublic'));

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Manager API rodando na porta ${PORT}`));
