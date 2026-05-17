// Librerias de terceros
// Router de Express
const { Router } = require('express');

const { validateFields, validateSFMPMessage } = require('../commons/commons')

// Controldor para procesar el post del balanceador
const { processCoordinatorSFMP } = require('./c_coordinator');

// Ruta post
const router = Router();


// Menajo de mensajes del protoclo SFMP
router.post('/'+process.env.SFMPROUTE, [
    validateSFMPMessage(),
    validateFields
],
processCoordinatorSFMP);
 
module.exports = router;