const { createSFMPMessage } = require('../commons/commons');
const { internalConfig } = require('./processorData');
const fs = require('fs'), path = require('path');
let receivedMessages = 0, duplicates = 0;
const registration = { main: false, subs: false, lastAttempt: null };
function setRegistration(values) { Object.assign(registration, values); }
// La ventana de idempotencia se conserva en disco para los reintentos tras reiniciar.
const file = path.join(process.env.DATA_DIR || path.join(__dirname, '..', '.data'), 'processor-' + internalConfig.port + '.json');
let seen = new Map(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []);
function processProcessorSFMP(req, res) {
    const { UID, Type, Operation } = req.body;
    const data = Type === 'REQUEST' && Operation === 'DEBUG' ? { internalConfig, receivedMessages, duplicates, registration } : { info: 'OK' };
    return res.json(createSFMPMessage('REPLY', 'RESULT', { UID, ...data }));
}
function processMessage(req, res) {
    const { UID, Data } = req.body;
    if (typeof UID !== 'string' || !UID || Data === undefined)
        return res.status(400).json({ error: 'Mensaje sin identificador o datos' });
    if (seen.has(UID)) {
        duplicates++;
        return res.json({ UID, Type: 'REPLY', Operation: 'RESULT', Data: { info: 'DUPLICATE' } });
    }
    const now = Date.now();
    seen = new Map([...seen].filter(([, time]) => now - time < 86400000));
    if (seen.size >= 10000)
        return res.status(503).json({ error: 'Ventana de idempotencia llena; reintentar más tarde' });
    seen.set(UID, now);
    try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file + '.tmp', JSON.stringify([...seen]));
        fs.renameSync(file + '.tmp', file);
    }
    catch (error) {
        seen.delete(UID);
        return res.status(503).json({ error: 'No se pudo confirmar el mensaje' });
    }
    receivedMessages++;
    console.log('Nos llega un mensaje del balanceador:', Data);
    return res.json({ UID, Type: 'REPLY', Operation: 'RESULT', Data: { info: 'OK' } });
}
module.exports = { processProcessorSFMP, processMessage, setRegistration };
