const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express'), cors = require('cors');
const app = express();
app.use(cors({ origin: (origin, next) => { const allowed = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean); const local = origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin); next(null, !origin || allowed.includes(origin) || (!allowed.length && local)); } }));
app.use(express.json({ limit: '64kb' }));
app.use('/api', (req, res, next) => process.env.API_TOKEN && req.get('authorization') !== 'Bearer ' + process.env.API_TOKEN ? res.status(401).json({ msg: 'Acceso no autorizado' }) : next());
app.use('/api', require('./routes/nodo'));
app.use((error, req, res, next) => { console.error(error.name); res.status(400).json({ ok: false, msg: 'Petición no válida' }); });
async function start() {
    const host = process.env.LISTEN_HOST || '127.0.0.1';
    if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.API_TOKEN)
        throw new Error('Configura API_TOKEN antes de exponer el catálogo');
    await require('./database/conexionDB').authenticate();
    return app.listen(Number(process.env.PORT || 8080), host, () => console.log('Catálogo disponible en ' + host + ':' + (process.env.PORT || 8080)));
}
if (require.main === module)
    start().catch(error => { console.error('No se pudo iniciar el catálogo:', error.name); process.exitCode = 1; });
module.exports = { app, start };
