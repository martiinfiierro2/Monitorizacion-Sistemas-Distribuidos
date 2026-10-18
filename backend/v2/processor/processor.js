// Cargar variables de entorno
const { protect, listenHost } = require('../commons/environment');
// Incluirmos la librería de express para levantar una API y CORS
const express = require('express');
const cors = require('cors');
// Metemos body-parser para poder parsear las request que nos llegarán por la API
const bodyParser = require('body-parser');
// Funciones auxiliares
const { parseArgs } = require('./functions');
// Obtenemso los párametros y los validamos o error
const parameters = parseArgs(process.argv);
if (parameters == -1)
    return;
// Creamos la APP y la configuramos para parsear JSON en la request
const app = express();
app.use(cors());
app.use(protect);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
// atendemos solo peticion post
app.use('/', require('./r_processor'));
// Levantamos el servidor en un puerto
const server = app.listen(parameters.port, listenHost(), function () {
    console.log(`PROCESSOR ${parameters.name} LISTENING PORT ${parameters.port}`);
});
const { createSFMPMessage, sendSFMPMessage } = require('../commons/commons');
const Data = { name: parameters.name, url: process.env.LOCAL_URL + ':' + parameters.port, capacity: parameters.capacity, preference: parameters.preference };
let registrationTimer, stopping = false;
async function register() {
    const results = await Promise.all([parameters.urlCoordinatorMain, parameters.urlCoordinatorSubs].map(url => sendSFMPMessage(url, createSFMPMessage('REQUEST', 'REGISTER', Data))));
    require('./c_processor').setRegistration({ main: results[0] === 1, subs: results[1] === 1, lastAttempt: new Date().toISOString() });
    if (!stopping)
        registrationTimer = setTimeout(register, Number(process.env.REGISTER_INTERVAL || 5000));
}
void register();
async function shutdown() {
    if (stopping)
        return;
    stopping = true;
    clearTimeout(registrationTimer);
    await Promise.all([parameters.urlCoordinatorMain, parameters.urlCoordinatorSubs].map(url => sendSFMPMessage(url, createSFMPMessage('REQUEST', 'UNREGISTER', Data))));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
