const axios = require('axios'), path = require('path'), mqtt = require('mqtt');
const config = require('./ttn/configTTN');
const { getInternal, internalConfig } = require('./balancerData');
const { createSFMPMessage, createResendMessage, requestSFMP, sendSFMPMessage, httpOptions } = require('../commons/commons');
const { addMessage, totalMeters, messageRate } = require('./loadMeter');
const { DeliveryQueue } = require('./delivery');
const balancerList = [];
const maxAttempts = () => Math.max(1, Number(process.env.AYAMAXSENDS || 3));
let balancerMainMaxAYA = maxAttempts(), balancerSubsActive = false, clientMQTT, timer, stopped = false, queue;
function deliveryQueue() {
    if (!queue)
        queue = new DeliveryQueue({
            file: path.join(process.env.DATA_DIR || path.join(__dirname, '..', '.data'), 'balancer-' + getInternal('port') + '.json'),
            retryMs: Number(process.env.DELIVERY_RETRY_MS || 1000), limit: Number(process.env.QUEUE_LIMIT || 1000),
            deliver: async (target, message) => {
                const response = await axios.post(target.url + '/' + (process.env.MSGROUTE || 'msg'), message, httpOptions());
                if (response.data?.UID !== message.UID)
                    throw new Error('Entrega sin confirmación correlacionada');
            }
        });
    return queue;
}
function configure(data) {
    if (!Array.isArray(data) || data.some(p => !p || typeof p.url !== 'string' || !/^https?:\/\//.test(p.url)))
        throw new Error('Lista de destinos inválida');
    balancerList.splice(0, balancerList.length, ...data.map(p => ({ ...p })));
    deliveryQueue().configure(balancerList);
}
const snapshot = () => ({ balancerSubsActive, balancerMainMaxAYA, receivedMessages: totalMeters(), receivedRate: messageRate(), internalConfig, balancerList, delivery: deliveryQueue().status(), mqttConnected: Boolean(clientMQTT?.connected) });
async function processBalancerSFMP(req, res) {
    const { UID, Type, Operation, Data } = req.body;
    const reply = data => res.json(createSFMPMessage('REPLY', 'RESULT', { UID, ...data }));
    if (Type !== 'REQUEST')
        return reply({ info: 'Operación no manejada' });
    try {
        if (Operation === 'DEBUG' || Operation === 'GETSTATUS') {
            const data = snapshot();
            if (Operation === 'GETSTATUS' && Data.urlCoordinator && (getInternal('type') === 'main' || balancerSubsActive))
                void sendSFMPMessage(Data.urlCoordinator, createSFMPMessage('REQUEST', 'INFOSTATUS', data));
            return reply(data);
        }
        if (Operation === 'SETCONFIG') {
            configure(Data);
            return reply({ info: 'OK' });
        }
        if (Operation === 'INFOSTATUS') {
            configure(Data.balancerList);
            return reply({ info: 'OK' });
        }
        if (Operation === 'AYA')
            return reply({ info: 'OK' });
        return reply({ info: 'Operación no manejada' });
    }
    catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
function disconnectMQTT() { if (clientMQTT) {
    clientMQTT.end();
    clientMQTT = undefined;
} }
function connectMQTT() {
    if (clientMQTT || process.env.MQTT_ENABLED === 'false')
        return;
    if (!config.appID || !config.accessKey) {
        console.warn('MQTT sin configurar; DEBUG y supervisión disponibles.');
        return;
    }
    clientMQTT = mqtt.connect(config.mqttQue, { username: config.appID, password: config.accessKey });
    clientMQTT.on('error', error => console.error('MQTT:', error.message));
    clientMQTT.on('connect', () => clientMQTT.subscribe(config.suscribe, { qos: 1 }));
    clientMQTT.on('message', (topic, message) => {
        try {
            addMessage();
            if (!deliveryQueue().enqueue(createResendMessage(getInternal('type'), message.toString())))
                console.error('Cola llena: mensaje rechazado. Revisa delivery.rejected en DEBUG.');
        }
        catch (error) {
            console.error('No se pudo guardar el mensaje:', error.message);
        }
    });
}
async function balancerAYA() {
    try {
        await requestSFMP(getInternal('urlMain'), createSFMPMessage('REQUEST', 'AYA', {}));
        if (balancerSubsActive) {
            await requestSFMP(getInternal('urlMain'), createSFMPMessage('REQUEST', 'INFOSTATUS', { balancerList }));
            disconnectMQTT();
        }
        balancerMainMaxAYA = maxAttempts();
        balancerSubsActive = false;
    }
    catch {
        balancerMainMaxAYA = Math.max(0, balancerMainMaxAYA - 1);
        if (!balancerMainMaxAYA && !balancerSubsActive) {
            balancerSubsActive = true;
            connectMQTT();
        }
    }
    finally {
        if (!stopped)
            timer = setTimeout(balancerAYA, Number(process.env.AYASENDTIME || 8000));
    }
}
function activeAYA() { if (getInternal('type') === 'subs' && !timer)
    timer = setTimeout(balancerAYA, 0); }
function stopBalancer() { stopped = true; clearTimeout(timer); disconnectMQTT(); queue?.stop(); }
module.exports = { connectMQTT, processBalancerSFMP, activeAYA, stopBalancer };
