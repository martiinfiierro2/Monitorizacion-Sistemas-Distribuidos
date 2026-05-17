// Librerias de terceros
// Router de Express
const { Router } = require('express');

const { validateFields, validateSFMPMessage } = require('../commons/commons')

// Controldor para procesar el post del balanceador
const { processBalancerSFMP } = require('./c_balancer');

// Ruta post
const router = Router();

// Menajo de mensajes del protoclo SFMP
router.post('/' + process.env.SFMPROUTE, [
    validateSFMPMessage(),
    validateFields
],
    processBalancerSFMP);


module.exports = router;