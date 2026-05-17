// Para tipar los parámetros
const { response, request } = require('express'); // Response de Express

const { addProcessor, deleteProcessor, updateBalancerList } = require('./functions');
const { createSFMPMessage, sendSFMPMessage } = require('../commons/commons')



// Lista de nodos registrados en el coordinador
// cada nodo tiene la forma: {name:'nombre', capacity:number, url:'call_url', preference: number}

const processorsList = [
    //    { name: 'name1', capacity: 100, url: 'http://localhost:3001', preference: 1, AYACOUNT:3, AYAUID:'' },
    //    { name: 'name2', capacity: 50, url: 'http://localhost:3002', preference: 0.5, AYACOUNT:3, AYAUID:'' }
];

// Configuración para el balanceador
// Lista de procesadores
const balancerList = [
    //    { name: 'example1', load: 50, url: 'http://localhost:3001' }
]

// Carga de mensajes del balanceador, se utilza para calcular la lsita de balancerList
// -1 indica que no se tienen datos de carga con lo que balancerList = procesorsList
var receivedMessages = -1;

// Variables para controlar reenvios de AYA al coordinador principal
var coordinatorMainMaxAYA = Number(process.env.AYAMAXSENDS);
// Variable para controlar si soy coordinadorSustitutoActivo
var coordinatorSubsActive = false;

const { getInternal, internalConfig } = require('./coordinatorData');

const processCoordinatorSFMP = (req = request, res = response) => {

    const { UID, Type, Operation, Data } = req.body;

    if (Type == 'REQUEST') {

        // Creamos un mensaje de respuesta por defecto
        var reply = createSFMPMessage('REPLY', 'RESULT', { info: 'Operación no manejada', UID: UID });


        if (Operation == 'DEBUG') {
            reply = createSFMPMessage('REPLY', 'RESULT', { UID: UID, coordinatorSubsActive, coordinatorMainMaxAYA, receivedMessages, processorsList, balancerList, internalConfig })
            res.status(200).json(reply)
            return;
        }


        if (Operation == 'REGISTER') {
            //console.log('Tenemos register de proceesor', Data)
            const result = addProcessor(Data, processorsList);
            switch (result) {
                case 1:
                    reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID });
                    res.status(200).json(reply);

                    // Ahora debe enviar un mensaje al balanceador para pedirle su estado y así actualizar la lista
                    const messageGETSTATUS = createSFMPMessage('REQUEST', 'GETSTATUS', { urlCoordinator: process.env.LOCAL_URL + ':' + getInternal('port') });
                    sendSFMPMessage(getInternal('urlBalancerMain'), messageGETSTATUS);
                    sendSFMPMessage(getInternal('urlBalancerSubs'), messageGETSTATUS);
                    //console.log('Envio de GETSTATUS a los dos balanceadores')
                    // Si hemos modificado la lista, ordenamos la lista por preferencia y carga y actualizamos la lista de balanceadores
                    //updateBalancerList(processorsList, balancerList, receivedMessages);
                    return;
                    break;
                case 0:
                    reply = createSFMPMessage('REPLY', 'RESULT', { info: 'ERROR ya existe el procesador', UID: UID })
                    res.status(200).json(reply);
                    return;
                    break;

                default:
                    reply = createSFMPMessage('REPLY', 'RESULT', { info: 'ERROR no se pudo añadir el procesador, error:' + result, UID: UID })
                    res.status(200).json(reply);
                    return;
                    break;
            }

        }

        if (Operation == 'UNREGISTER') {
            const result = deleteProcessor(Data, processorsList);
            switch (result) {
                case 1:
                    reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID });
                    res.status(200).json(reply);

                    // Si hemos modificado la lista, ordenamos la lista por preferencia y carga y actualizamos la lista de balanceadores
                    updateBalancerList(processorsList, balancerList, receivedMessages);
                    return;
                    break;
                case 0:
                    reply = createSFMPMessage('REPLY', 'RESULT', { info: 'ERROR el procesador no existe', UID: UID })
                    res.status(200).json(reply);
                    return;

                    break;

                default:
                    reply = createSFMPMessage('REPLY', 'RESULT', { info: 'ERROR no se pudo borrar el procesador, error:' + result, UID: UID })
                    res.status(200).json(reply);
                    return;
                    break;
            }

        }

        if (Operation == 'INFOSTATUS') {
            // Recibe infostatus del balanceador, nos interesa el total
            reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID });
            res.status(200).json(reply);

            // este infostatus se recibe
            //  - desde el balanceador tras un getstatus, y es para actualizar el número de mensajes por segundo que recibe el balanceador
            //  y así calcular la balancerList
            // - desde un coordinador principal, porque soy el subs y estoy actualizando mi estado interno, recibir processorsList y balancerList

            // si en el Data viene el campo receivedMessages es el primer caso

            receivedMessages = Data.receivedMessages;// || -1;
            if (receivedMessages == undefined) {
                receivedMessages = Data.coordinatorReceivedMessages;
                //console.log('Viene de un coordinador main:',Data);
                // borramos la lista de processorsList y balancerList y metemos la que nos ha llegado
                processorsList.splice(0, processorsList.length)
                for (i = 0; i < Data.processorsList.length; i++) {
                    processorsList.push(Data.processorsList[i]);
                }
                balancerList.splice(0, balancerList.length)
                for (i = 0; i < Data.balancerList.length; i++) {
                    balancerList.push(Data.balancerList[i]);
                }
                //console.log('La procccesorList del coordinador subs es:', processorsList,' y el balancerList:',balancerList)
                return;
            } else {
                //console.log('Recibimos INFOSTATUS Actualizar receivedMessages:', receivedMessages)
                updateBalancerList(processorsList, balancerList, receivedMessages);
            }
            // hacer un SETCONFIG al balanceador
            const messageSETCONFIG = createSFMPMessage('REQUEST', 'SETCONFIG', balancerList)
            // Envía los setconfig a los balanceadores princial y sustituto
            sendSFMPMessage(getInternal('urlBalancerMain'), messageSETCONFIG);
            sendSFMPMessage(getInternal('urlBalancerSubs'), messageSETCONFIG);
            //console.log('Hacemos SETCONFIG balanceador principal y sustituo')

            return;

        }

        if (Operation == 'AYA') {
            reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID });
            res.status(200).json(reply);
            //console.log('Soy coordinador y me llega un aya, constesto con un INFOSTATUS')
            const messsageINFOSTATUS = createSFMPMessage('REQUEST', 'INFOSTATUS', {coordinatorReceivedMessages:receivedMessages, processorsList:processorsList, balancerList:balancerList})
            sendSFMPMessage(Data.urlCoordinatorSubs, messsageINFOSTATUS);
            return;
        }

        if (Operation == 'GETSTATUS') {
            reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID })
            res.status(200).json(reply);

            //console.log('GETSTATUS, nos llega Data:', Data);
        }

        // Se envía el mensaje de reply generado
        res.status(200).json(reply);
        return;
    }

    if (Type == 'REPLY') {
        // NO HACEMOS NADA
    }

    res.status(200).json(reply);
    return;
}

const axios = require('axios');

// Activar AYA, se programa el envio de los AYA y el de los resendAYA cuando hay algun processor que no ha contestado antes
const activateAYA = () => {
    // Si soy proceso sustituto activo el AYA hacia el coordinador principal
    if (getInternal('type') == 'subs') {
        setTimeout(coordinatorAYA, Number(process.env.AYASENDTIME))
        //console.log('Proceso SUBS activa AYA hacia cooridnador principal en seg:', Number(process.env.AYASENDTIME))
        return;
    }
    // Soy el coordinador principal, activo los AYA hacia los procesadores
    if (getInternal('type') == 'main') {
        //console.log('Activando AYA en: SEND(', process.env.AYASENDTIME, ') y RESEND(', process.env.AYARESENDTIME, ')');
        setTimeout(processorsAYA, Number(process.env.AYASENDTIME));
        setTimeout(processorsResendAYA, Number(process.env.AYARESENDTIME))
    }
}



// Enviar mensaje a coordinador principal para controlar que sigue activo
function coordinatorAYA() {
    //console.log('Inicio envio AYA corodinador suplente a coordinador princiapl')
    const data = { urlCoordinatorSubs: process.env.LOCAL_URL + ':' + getInternal('port') }
    const messageAYACoordinator = createSFMPMessage('REQUEST', 'AYA', data);
    //console.log('Envio AYA a cordinador main ', getInternal('urlCoordinatorlMain'), ' con data:', messageAYACoordinator)

    axios.post(getInternal('urlCoordinatorlMain') + '/' + process.env.SFMPROUTE, messageAYACoordinator)
        .then(function (response) {
            //console.log('El coordinador principal sigue activo');
            // Si soy un subs activo y me acaban de responder, le hago un INFOSTATUS al principal
            if (coordinatorSubsActive) {
                const messsageINFOSTATUS = createSFMPMessage('REQUEST', 'INFOSTATUS', {processorsList:processorsList, balancerList:balancerList})
                sendSFMPMessage(getInternal('urlCoordinatorlMain'), messsageINFOSTATUS);
            }

            coordinatorMainMaxAYA = Number(process.env.AYAMAXSENDS);
            coordinatorSubsActive = false;
            setTimeout(coordinatorAYA, Number(process.env.AYASENDTIME))
        })
        .catch(function (error) {
            //console.log('El coordinador principal no contesta, hacemos resend');
            coordinatorMainMaxAYA--;
            if (coordinatorMainMaxAYA <= 0) {
                //console.log('Ya se han terminado los intentos, debe asumir el rol de coordinador principal');
                if (getInternal('type') == 'subs') {
                    // Activo el coordinador SUBS, activo el updateconfig
                    coordinatorSubsActive = true;
                    activateUPDATECONFIG();
                }
                // Activmos envio de AYAs a los procesadores
                setTimeout(processorsAYA, Number(process.env.AYASENDTIME))


                // Dejo programado el siguiete AYA por
                //console.log('Dejo el AYA de comprobación activo')
                setTimeout(coordinatorAYA, Number(process.env.AYASENDTIME))


            } else {
                //console.log('Reenviamos AYA a coordinador principal en:', process.env.AYARESENDTIME)
                setTimeout(coordinatorAYA, Number(process.env.AYARESENDTIME))
            }
        });
}

// Enviar AYA a los procesadores en la lista
function processorsAYA() {

    // Si por un casual fuese subs y ya no estoy activo, salgo del processorAYA porque el main ya lo estará haciendo
    if (getInternal('type') == 'subs' && coordinatorSubsActive == false) return;

    //console.log('Inicio envio de mensajes AYA de coordinador a procesadores');
    // enviamos un mensaje AYA a cada elemento de la lista de processorsList, descontamos un numero en el AYACOUNT y anotamos el UID
    processorsList.forEach(element => {
        //console.log('Envío AYA a:', element)
        const message = createSFMPMessage('REQUEST', 'AYA', {});
        element.AYACOUNT--;
        element.AYAUID = message.UID;

        axios.post(element.url + '/' + process.env.SFMPROUTE, message)
            .then(function (response) {
                if (response.data.Data.UID == element.AYAUID) {
                    element.AYACOUNT = Number(process.env.AYAMAXSENDS);
                    element.AYAUID = '';
                    //console.log('Responde AYA:', element)
                }
            })
            .catch(function (error) {
                ////console.log('error:',error);
            });

    });
    //console.log('Enviado AYA processorsList:', processorsList)
    // Si soy el coordinador principal o soy un subs activo programo siguiente processorsAYA
    if (getInternal('type') == 'main' || coordinatorSubsActive) {
        setTimeout(processorsAYA, Number(process.env.AYASENDTIME))
    }
}

// Hacer resend solo a los procesadores que están pendiente de contestar
function processorsResendAYA() {
    //console.log('Inicio Resend de mensajes AYA');
    // eliminamos de processorsList todos los que tengan AYACOUNT a 0 porque significa que ya se han enviado todos los intentos posibles

    var deleted = 0;
    for (let index = 0; index < processorsList.length; index++) {
        if (processorsList[index].AYACOUNT <= 0) {
            //console.log('Eliminar processador:', processorsList[index]);
            processorsList.splice(index, 1);
            deleted++;
        }
    }

    // Si he eliminado procesadores de la lista hay que actualizar la lista, para eso se envía un GETINFO al balanceador
    if (deleted > 0) {
        // Se actaaliza la lista con los procesadores que hay activos y la carga que se tiene en se momento
        // Ahora debe enviar un mensaje al balanceador para pedirle su estado y así actualizar la lista
        const messageGETSTATUS = createSFMPMessage('REQUEST', 'GETSTATUS', { urlCoordinator: process.env.LOCAL_URL + ':' + getInternal('port') });
        sendSFMPMessage(getInternal('urlBalancerMain'), messageGETSTATUS);
        sendSFMPMessage(getInternal('urlBalancerSubs'), messageGETSTATUS);
        //console.log('Envio de GETSTATUS a los dos balanceadores')
    }

    const resendList = [];
    // enviamos un mensaje AYA a cada elemento de la lista de processorsList, descontamos un numero en el AYACOUNT y anotamos el UID
    processorsList.forEach(element => {
        // Solo para los elmentos que están pendientes de recibir contestación, enviamos mensaje
        if (element.AYACOUNT < Number(process.env.AYAMAXSENDS)) {
            resendList.push(element);
            //console.log('Envío ResendAYA a:', element)
            const message = createSFMPMessage('REQUEST', 'AYA', {});
            element.AYACOUNT--;
            element.AYAUID = message.UID;
            axios.post(element.url + '/' + process.env.SFMPROUTE, message)
                .then(function (response) {
                    if (response.data.Data.UID == element.AYAUID) {
                        element.AYACOUNT = Number(process.env.AYAMAXSENDS);
                        element.AYAUID = '';
                        //console.log('Responde de Resend AYA:', element)
                    }
                })
                .catch(function (error) {
                    //console.log('error:',error);
                });

        }
    });
    //console.log('Enviado RESEND AYA processorsList:', resendList)
    setTimeout(processorsResendAYA, Number(process.env.AYARESENDTIME))
}

// Programar que cada UPDATECONFIG segundos se haga GETSTATUS al balanceador para renovar 
const activateUPDATECONFIG = () => {
    if (getInternal('type') == 'subs' && coordinatorSubsActive) {
        //console.log('Soy el cooordinador subs y estoy activo, activo UPDATECONFIG')
        setTimeout(updateConfig, process.env.UPDATE_CONFIG)
        return;
    }
    // Soy el coordinador principal, activo los AYA hacia los procesadores
    if (getInternal('type') == 'main') {
        //console.log('Soy el cooordinador main, activo UPDATECONFIG')
        setTimeout(updateConfig, process.env.UPDATE_CONFIG);
    }

}

const updateConfig = () => {
    // Enviar mensaje de GETSTATUS al los balanceadores main y subs
    const messageGETSTATUS = createSFMPMessage('REQUEST', 'GETSTATUS', { urlCoordinator: process.env.LOCAL_URL + ':' + getInternal('port') });
    sendSFMPMessage(getInternal('urlBalancerMain'), messageGETSTATUS);
    sendSFMPMessage(getInternal('urlBalancerSubs'), messageGETSTATUS);
    //console.log('Envio de GETSTATUS a los dos balanceadores')
}

module.exports = { processCoordinatorSFMP, activateAYA, activateUPDATECONFIG }