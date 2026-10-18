const axios = require('axios');
const { validationResult, body } = require('express-validator');
const { uid } = require('uid');
const createSFMPMessage = (Type = 'REPLY', Operation = 'RESULT', Data = {}) => ({ UID: uid(25), Type: Type.toUpperCase(), Operation: Operation.toUpperCase(), Data });
const createResendMessage = (Origin = '', Data = {}) => ({ UID: uid(25), Origin, Data });
const httpOptions = () => ({ timeout: Number(process.env.REQUEST_TIMEOUT || 2000), headers: process.env.SFMP_TOKEN ? { Authorization: 'Bearer ' + process.env.SFMP_TOKEN } : {} });
const requestSFMP = async (url, message) => {
    const response = await axios.post(url.replace(/\/$/, '') + '/' + (process.env.SFMPROUTE || 'sfmp'), message, httpOptions());
    if (response.data?.Data?.UID !== message.UID)
        throw new Error('Respuesta SFMP no correlacionada');
    return response.data.Data;
};
const sendSFMPMessage = async (url = '', data = {}) => { if (!url)
    return 0; try {
    await requestSFMP(url, data);
    return 1;
}
catch {
    return -1;
} };
const validateFields = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
        return res.status(400).json({ errores: errors.mapped() });
    next();
};
const validateSFMPMessage = () => [
    body('UID').exists({ checkNull: true }), body('Type').isIn(['REQUEST', 'REPLY']),
    body('Operation').isIn(['DEBUG', 'GETSTATUS', 'INFOSTATUS', 'SETCONFIG', 'REGISTER', 'UNREGISTER', 'AREYOUALIVE', 'RESULT', 'AYA']),
    body('Data').custom(value => value !== null && typeof value === 'object')
];
module.exports = { createSFMPMessage, createResendMessage, requestSFMP, sendSFMPMessage, httpOptions, validateFields, validateSFMPMessage };
