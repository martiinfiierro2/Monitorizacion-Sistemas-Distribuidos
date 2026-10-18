const { body, param } = require('express-validator');
const types = ['Controlador Main', 'Controlador Subs', 'Balanceador Main', 'Balanceador Subs', 'Procesador'];
function normalizeAddress(data) {
    const url = new URL(String(data.url).trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
        throw new Error('Introduce una URL base HTTP, sin ruta ni credenciales');
    if (url.port && Number(url.port) !== Number(data.puerto))
        throw new Error('El puerto de la URL no coincide con el campo puerto');
    if (['localhost', '[::1]'].includes(url.hostname))
        url.hostname = '127.0.0.1';
    url.port = '';
    return { ...data, url: url.origin, puerto: String(Number(data.puerto)) };
}
const idRules = [param('id').isInt({ min: 1 }).withMessage('Identificador no válido')];
const nodeRules = [
    body('tipo_nodo').isIn(types).withMessage('Tipo de nodo no válido'),
    body('nombre').isString().bail().trim().isLength({ min: 1, max: 50 }).withMessage('El nombre debe tener entre 1 y 50 caracteres'),
    body('puerto').isInt({ min: 1, max: 65535 }).withMessage('Puerto entre 1 y 65535'),
    body('url').isString().bail().custom((value, { req }) => { normalizeAddress(req.body); return true; }),
    body('latitud').isFloat({ min: -90, max: 90 }).withMessage('Latitud entre -90 y 90'),
    body('longitud').isFloat({ min: -180, max: 180 }).withMessage('Longitud entre -180 y 180'),
    body('visible').isBoolean({ strict: true }).withMessage('Visibilidad no válida'),
    body('orden').optional({ nullable: true }).isInt({ min: 0 }).withMessage('El orden debe ser un entero positivo'),
    body('tiempo').optional({ nullable: true }).isISO8601().withMessage('Fecha ISO no válida')
];
module.exports = { normalizeAddress, nodeRules, idRules };
