const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
function protect(req, res, next) {
    const token = process.env.SFMP_TOKEN;
    if (token && req.get('authorization') !== 'Bearer ' + token)
        return res.status(401).json({ error: 'Acceso no autorizado' });
    next();
}
function listenHost() {
    const host = process.env.LISTEN_HOST || '127.0.0.1';
    if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.SFMP_TOKEN)
        throw new Error('Configura SFMP_TOKEN antes de exponer los procesos fuera de localhost.');
    return host;
}
module.exports = { protect, listenHost };
