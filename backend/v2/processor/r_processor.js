// Librerias de terceros 
// Router de Express
const { Router } = require('express');

const { validateFields, validateSFMPMessage } = require('../commons/commons')

// Controldor para procesar el post del balanceador
const { processProcessorSFMP, processMessage } = require('./c_processor');

// Ruta post
const router = Router();


// Menajo de mensajes del protoclo SFMP
router.post('/'+process.env.SFMPROUTE, [
    validateSFMPMessage(),
    validateFields
],
processProcessorSFMP);

// Menajo de mensajes del protoclo SFMP
router.post('/'+process.env.MSGROUTE, 
processMessage);
 
module.exports = router;