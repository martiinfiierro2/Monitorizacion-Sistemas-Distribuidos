// Para tipar los parámetros
const { response, request } = require('express'); // Response de Express

//const { addProcessor, deleteProcessor, updateBalancerList } = require('./functions');
const { createSFMPMessage } = require('../commons/commons')

const { internalConfig } = require('./processorData')

const processProcessorSFMP = (req = request, res = response) => {

    const { UID, Type, Operation, Data } = req.body;
    var reply = createSFMPMessage('REPLY', 'RESULT', { info: 'Operación no manejada', UID: UID });
    if (Type == 'REQUEST') { 

        if (Operation == 'DEBUG') {
            reply = createSFMPMessage('REPLY', 'RESULT', { UID: UID, internalConfig })
            res.status(200).json(reply)
            return;
        }

        if (Operation == 'AYA') {
            reply = createSFMPMessage('REPLY', 'RESULT', { info: 'OK', UID: UID }); 
            //console.log('Recibido AYA de',UID)
        }

        // Se envía el mensaje de reply generado
        res.status(200).json(reply);
        return;
    }

    res.status(200).json(reply);
    return;

}

// función que procesa un mensaje cuando es recibido
const processMessage = (req = request, res = response) => {

    const msg = req.body.Data;
    console.log('Nos llega un mensaje del balanceador:', msg);

    res.status(200).json({
        UID: 'sendBalancerMessage',
        Type: '',
        Operation: '',
        Data: ''
    })
}

module.exports = {processProcessorSFMP, processMessage}