// Para tipar los parámetros
const { response, request } = require('express'); // Response de Express

const { updateBalancerList } = require('./functions');
const { createSFMPMessage, sendSFMPMessage, createResendMessage } = require('../commons/commons')

// Lista de nodos que maneja el balanceador
// Lista de procesadores
const balancerList = [
    //    { name: 'example1', load: 50, url: 'http://localhost:3001' }
]

// mecanismo para reenvio, temporal, esto se va fuera
var pivote = 0;



const { getInternal, internalConfig } = require('./balancerData');

// Variables para controlar reenvios de AYA al coordinador principal
var balancerMainMaxAYA = Number(process.env.AYAMAXSENDS);
// Variable para controlar si soy coordinadorSustitutoActivo
var balancerSubsActive = false;
var receivedMessages = -1;

const axios = require('axios');

const processBalancerSFMP = (req = request, res = response) => {

    const { UID, Type, Operation, Data } = req.body;
    var reply = createSFMPMessage('REPLY', 'RESULT', { info: 'Operación no manejada', UID: UID })

    if (Type == 'REQUEST') {

        if (Operation == 'DEBUG') {
            reply = createSFMPMessage('REPLY', 'RESULT', { UID: UID, balancerSubsActive, balancerMainMaxAYA, receivedMessages, internalConfig, balancerList })
            res.status(200).json(reply)
            return;
        }

        // Me llega un infostatus del balanceador secundario, cojo los datos
        if (Operation == 'INFOSTATUS') {
            receivedMessages = Data.receivedMessages;
            balancerList.splice(0, balancerList.length);
            for (i = 0; i < Data.balancerList.length; i++) {
                balancerList.push(Data.balancerList[i])
            }
            reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID })
            res.status(200).json(reply);
            return;
        }

        // Si nos piden el estado del sistema, contestamos
        if (Operation == 'GETSTATUS') {
            reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID })
            res.status(200).json(reply);
            // si soy el balanceador subs y no estoy activo, NO contesto
            if (getInternal('type') == 'subs' && balancerSubsActive == false) return

            //console.log('GETSTATUS, nos llega Data:', Data);
            const urlCoordinator = Data.urlCoordinator;
            // load implica porcentaje, receivedMessages indica cantidad
            const newData = { receivedMessages: receivedMessages, balancerList: balancerList };
            const messageINFOSTATUS = createSFMPMessage('REQUEST', 'INFOSTATUS', newData)
            //console.log('Hacemos un infoSTATUS a a:', urlCoordinator, ' con la lista:', newData)
            sendSFMPMessage(urlCoordinator, messageINFOSTATUS);

            return;
        }

        // Llega una nueva configuración y la guardamos
        if (Operation == 'SETCONFIG') {
            //console.log('Actualizamos balancerList:', Data);
            updateBalancerList(balancerList, Data);
            reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID })
            res.status(200).json(reply);

            return;

        }

        if (Operation == 'AYA') {
            reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID });
            res.status(200).json(reply);

            return;
        }

    }

    if (Type == 'REPLY') {
        // NO HACEMOS NADA
    }

    res.status(200).json(reply);
    return;
}


const activeAYA = () => {
    if (getInternal('type') == 'subs') {
        setTimeout(balancerAYA, process.env.AYASENDTIME);
    }
}

const balancerAYA = () => {
    // Envio un AYA al principal
    const messageAYABalancer = createSFMPMessage('REQUEST', 'AYA', {});
    //console.log('BalancedorAYA envía a: ', getInternal('urlMain') + '/' + process.env.SFMPROUTE, ' el mensaje: ', messageAYABalancer)
    axios.post(getInternal('urlMain') + '/' + process.env.SFMPROUTE, messageAYABalancer)
        .then(function (response) {
            // console.log('lo qu erespende al aya:',response)
            //console.log('El balanceador principal sigue activo:', messageAYABalancer.UID == response.data.Data.UID);
            // Si soy un subs activo y me acaban de responder, le hago un INFOSTATUS al principal
            if (balancerSubsActive) {
                // Desactivamos el envio de mensajes desde balanceador hacia los procesadores
                // para eso simplemente cerramos la conexión con MQTT
                disconnectMQTT();
                const messageINFOSTATUS = createSFMPMessage('REQUEST', 'INFOSTATUS', { receivedMessages, balancerList });
                //console.log('Envio INFOSTATUS del balanceador subs al main:', getInternal('urlMain'), balancerList)
                sendSFMPMessage(getInternal('urlMain'), messageINFOSTATUS);
                //console.log('Desconecto de MQTT')
            }

            balancerMainMaxAYA = Number(process.env.AYAMAXSENDS);
            balancerSubsActive = false;
            setTimeout(balancerAYA, process.env.AYASENDTIME);
        })
        .catch(function (error) {
            //console.log('El balanceador principal no responde:');//,error);
            balancerMainMaxAYA--;
            if (balancerMainMaxAYA <= 0) {
                //console.log('Ya se han terminado los intentos, debe asumir el rol de balanceador principal principal');
                // Si soy subs y no he asumido ya el control, asumo el control, me conecto a MQTT y le sigo lanzando AYA al balanceador
                if (getInternal('type') == 'subs' && balancerSubsActive == false) {

                    balancerSubsActive = true;
                    //console.log('Coneccto con MQTT');
                    connectMQTT();

                }

                // Dejo programado el siguiete AYA por
                //console.log('Dejo el AYA de comprobación activo')
                setTimeout(balancerAYA, Number(process.env.AYASENDTIME))


            } else {
                //console.log('Reenviamos AYA a balanceador principal en:', process.env.AYARESENDTIME)
                setTimeout(balancerAYA, Number(process.env.AYARESENDTIME))
            }
        })

}

// Conectarnos con MQTT
// Configuramos la conexión a MQTT para pillar la de TTN
const config = require('./ttn/configTTN');
const mqtt = require('mqtt');
const { create } = require('domain');

var clientMQTT;

const disconnectMQTT = () => {
    clientMQTT.unsubscribe(config.mqttQue);
    clientMQTT.end();
}

const { addMessage, totalMeters} = require('./loadMeter');

// Función que reenvia el mensaje al procesador que toca en funcíon de su carga
const resendMessage = (message) => {
    console.log('Resend message')
    addMessage();
    receivedMessages = totalMeters();
    //console.log('Balanceador receivedMessages:',receivedMessages)
    if (balancerList.length > 0) {
        console.log('Enviamos a:',balancerList[pivote].url + '/' + process.env.MSGROUTE)
        const newMessage = createResendMessage(getInternal('type'), message.toString());
        axios.post(balancerList[pivote].url + '/' + process.env.MSGROUTE, newMessage)
            .then(function (response) {

            })

            .catch(function (error) {
            })
        // Avanzamos pivite si no está ya al final
        pivote == balancerList.length - 1 ? pivote=0: pivote++;
        //console.log('Pivote nuevo:',pivote);
    } else {
        console.log('No hay elementos en la lista de balancerList')
    }
}

const connectMQTT = () => {

    clientMQTT = mqtt.connect((config.mqttQue), {
        username: config.appID,
        password: config.accessKey
    });

    clientMQTT.on('connect', () => {
        clientMQTT.subscribe(config.suscribe);
    });

    clientMQTT.on('message', async (topic, message) => {
        try {
            // console.log('Mensaje original recibido:')
            // console.log(String(message));

            resendMessage(message)
            //await sendMessage(message);
        } catch (error) {
            //console.log(error)
        }
    });
}

module.exports = { connectMQTT, processBalancerSFMP, activeAYA }

