// Librerias de terceros
const axios = require('axios');
const { response, request } = require('express'); // Response de Express
const { validationResult, check } = require('express-validator'); // ValidationResult de Express Validator

const permetedTypes = ['REQUEST', 'REPLY'];
const permetedOperations = ['DEBUG','GETSTATUS', 'INFOSTATUS', 'SETCONFIG', 'REGISTER', 'UNREGISTER', 'AREYOUALIVE','RESULT','AYA']

const {uid} = require('uid');



// Crea un nuevo UID único
const newUID = ()=> {
    return uid(Number(25));
}

const defaultMessage = {UID:newUID(), Type:'REPLY', Operation:'RESULT', Data: {info:'INVALID MESSAGE', UID:-1}};

// Función que crea un mensaje SFMP
const createSFMPMessage = (Type='REPLY', Operation='RESULT', Data={}) => {
    // Comprobamos los parámetros que pasa y si no son correcto deolvemos un mensaje vacio.
    Type = Type.toUpperCase();
    Operation = Operation.toUpperCase();
    if (!permetedTypes.includes(Type) || !permetedOperations.includes(Operation)) return defaultMessage;
    return {
        UID:newUID(),
        Type,
        Operation,
        Data
    };
}

const createResendMessage = (Origin='', Data={}) => {
    // Comprobamos los parámetros que pasa y si no son correcto deolvemos un mensaje vacio.
    return {
        UID:newUID(),
        Origin,
        Data
    };
}

// Función para enviar mensajes por SFMP
const sendSFMPMessage = async (url='', data={}) => { 
    if (url.length<=0) return 0;
    //console.log('sendSFMPMessage enviado a:',url+'/'+process.env.SFMPROUTE);
    axios.post(url+'/'+process.env.SFMPROUTE, data)
        .then(function (response) {
           // console.log('enviado a:',url+'/'+process.env.SFMPROUTE);
            //console.log(response.data);
            return 1;
        })
        .catch(function (error) {
            //console.log('Error en sendSFMPMessage: ',error);
            return -1;
        });
    return 0;
}

/**
 * Comprobación de si hay errores detectados durante el manejo de la ruta
 */

const validateFields = (req = request, res = response, next) => {

   const erroresVal = validationResult(req);
    if (!erroresVal.isEmpty()) {
        res.status(400).json({
            errores: erroresVal.mapped()
        });
        return;
    }  
    next();
}

// Función que comprueba que un mensaje cumple con la estructura de SFMP
const validateSFMPMessage = () => {
    return [
        check(['UID', 'Type', 'Operation', 'Data'], 'Field is missing or empty').notEmpty(),
        check('Type', 'Permeted type are ' + String(permetedTypes)).isIn(permetedTypes),
        check('Operation', 'Permeted operations are ' + String(permetedOperations)).isIn(permetedOperations),
    ]
}

// Marcar para exportar.
module.exports = { createSFMPMessage, validateFields, validateSFMPMessage, sendSFMPMessage, createResendMessage }