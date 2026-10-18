const { addProcessor, deleteProcessor, updateBalancerList } = require('./functions');
const { createSFMPMessage, requestSFMP, sendSFMPMessage } = require('../commons/commons');
const { getInternal, internalConfig } = require('./coordinatorData');
const processorsList = [], balancerList = [];
const maxAttempts = () => Math.max(1, Number(process.env.AYAMAXSENDS || 3));
let receivedMessages = -1, receivedRate = -1, coordinatorMainMaxAYA = maxAttempts();
let coordinatorSubsActive = false, timer, started = false, stopped = false;
const active = () => getInternal('type') === 'main' || coordinatorSubsActive;
const snapshot = () => ({ coordinatorSubsActive, coordinatorMainMaxAYA, receivedMessages, receivedRate, processorsList, balancerList, internalConfig });
const replication = () => ({ coordinatorReceivedMessages: receivedMessages, receivedRate, processorsList, balancerList });
function restore(data) {
    if (!Array.isArray(data.processorsList) || !Array.isArray(data.balancerList))
        throw new Error('Estado replicado inválido');
    processorsList.splice(0, processorsList.length, ...data.processorsList.map(p => ({ ...p })));
    balancerList.splice(0, balancerList.length, ...data.balancerList.map(p => ({ ...p })));
    if (Number.isFinite(data.coordinatorReceivedMessages))
        receivedMessages = data.coordinatorReceivedMessages;
    if (Number.isFinite(data.receivedRate))
        receivedRate = data.receivedRate;
}
async function publish() {
    if (!active())
        return;
    updateBalancerList(processorsList, balancerList, receivedRate);
    await Promise.all(['urlBalancerMain', 'urlBalancerSubs'].map(key => sendSFMPMessage(getInternal(key), createSFMPMessage('REQUEST', 'SETCONFIG', balancerList))));
}
async function updateConfig() {
    if (!active())
        return;
    for (const key of ['urlBalancerMain', 'urlBalancerSubs']) {
        try {
            const data = await requestSFMP(getInternal(key), createSFMPMessage('REQUEST', 'GETSTATUS', {}));
            if (key === 'urlBalancerSubs' && !data.balancerSubsActive)
                continue;
            if (Number.isFinite(data.receivedMessages))
                receivedMessages = data.receivedMessages;
            if (Number.isFinite(data.receivedRate))
                receivedRate = data.receivedRate;
            break;
        }
        catch { /* El siguiente destino puede ser el sustituto activo. */ }
    }
    await publish();
}
async function checkProcessors() {
    await Promise.all(processorsList.slice().map(async (processor) => {
        const message = createSFMPMessage('REQUEST', 'AYA', {});
        processor.AYAUID = message.UID;
        try {
            await requestSFMP(processor.url, message);
            processor.AYACOUNT = maxAttempts();
        }
        catch {
            processor.AYACOUNT = Math.max(0, processor.AYACOUNT - 1);
        }
        processor.AYAUID = '';
    }));
    for (let i = processorsList.length - 1; i >= 0; i--)
        if (processorsList[i].AYACOUNT <= 0)
            processorsList.splice(i, 1);
}
async function checkMain() {
    try {
        const data = await requestSFMP(getInternal('urlCoordinatorlMain'), createSFMPMessage('REQUEST', 'AYA', {}));
        if (coordinatorSubsActive)
            await requestSFMP(getInternal('urlCoordinatorlMain'), createSFMPMessage('REQUEST', 'INFOSTATUS', replication()));
        else if (Array.isArray(data.processorsList))
            restore(data);
        coordinatorMainMaxAYA = maxAttempts();
        coordinatorSubsActive = false;
    }
    catch {
        coordinatorMainMaxAYA = Math.max(0, coordinatorMainMaxAYA - 1);
        if (!coordinatorMainMaxAYA)
            coordinatorSubsActive = true;
    }
}
async function tick() {
    if (stopped)
        return;
    try {
        if (getInternal('type') === 'subs')
            await checkMain();
        if (active()) {
            await checkProcessors();
            await updateConfig();
        }
    }
    catch (error) {
        console.error('Supervisión del coordinador:', error.message);
    }
    finally {
        if (!stopped)
            timer = setTimeout(tick, Number(process.env.AYASENDTIME || 8000));
    }
}
function activateAYA() { if (!started) {
    started = true;
    stopped = false;
    timer = setTimeout(tick, 0);
} }
function activateUPDATECONFIG() { activateAYA(); }
function stopCoordinator() { stopped = true; clearTimeout(timer); }
async function processCoordinatorSFMP(req, res) {
    const { UID, Type, Operation, Data } = req.body;
    const reply = data => res.json(createSFMPMessage('REPLY', 'RESULT', { UID, ...data }));
    if (Type !== 'REQUEST')
        return reply({ info: 'Operación no manejada' });
    try {
        if (Operation === 'DEBUG' || Operation === 'GETSTATUS')
            return reply(snapshot());
        if (Operation === 'AYA')
            return reply({ info: 'OK', ...replication() });
        if (Operation === 'REGISTER') {
            const result = addProcessor(Data, processorsList);
            if (result <= 0)
                return res.status(409).json({ error: 'Nombre duplicado o registro inválido' });
            await publish();
            return reply({ info: 'OK' });
        }
        if (Operation === 'UNREGISTER') {
            deleteProcessor(Data, processorsList);
            await publish();
            return reply({ info: 'OK' });
        }
        if (Operation === 'INFOSTATUS') {
            if (Array.isArray(Data.processorsList))
                restore(Data);
            else if (active()) {
                if (Number.isFinite(Data.receivedMessages))
                    receivedMessages = Data.receivedMessages;
                if (Number.isFinite(Data.receivedRate))
                    receivedRate = Data.receivedRate;
            }
            await publish();
            return reply({ info: 'OK' });
        }
        return reply({ info: 'Operación no manejada' });
    }
    catch (error) {
        return res.status(400).json({ error: error.message });
    }
}
module.exports = { processCoordinatorSFMP, activateAYA, activateUPDATECONFIG, stopCoordinator };
