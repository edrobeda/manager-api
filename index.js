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
// Imagens enviadas via upload precisam ser públicas — <img> não manda header de Authorization
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/uploads', auth, require('./routes/uploads'));
app.use('/api/produtos-totem', auth, require('./routes/produtosTotem'));
app.use('/api/config-totem', auth, require('./routes/configTotem'));
app.use('/api/totem',       auth, require('./routes/totemPublic'));

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => console.log(`Manager API rodando na porta ${PORT}`));
