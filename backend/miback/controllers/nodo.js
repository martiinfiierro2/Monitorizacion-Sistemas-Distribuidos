const { Nodo } = require('../models/nodo');
const { Op } = require('sequelize');
const { normalizeAddress } = require('../middleware/node-validation');
const fields = ['tipo_nodo', 'nombre', 'url', 'puerto', 'latitud', 'longitud', 'visible', 'orden'];
const values = body => normalizeAddress(Object.fromEntries(fields.filter(key => body[key] !== undefined).map(key => [key, body[key]])));
const failure = (res, error) => { console.error('Catálogo:', error.name); return res.status(error.name === 'SequelizeUniqueConstraintError' ? 409 : 503).json({ ok: false, msg: error.name === 'SequelizeUniqueConstraintError' ? 'Ya existe ese destino' : 'No se pudo acceder al catálogo. Comprueba la base de datos.' }); };
const obtain = ordered => async (req, res) => { try {
    return res.json({ ok: true, nodos: await Nodo.findAll({ order: ordered ? [['orden', 'ASC'], ['id', 'ASC']] : [['id', 'ASC']] }) });
}
catch (e) {
    return failure(res, e);
} };
const obtenerNodos = obtain(false), obtenerNodosOrdenados = obtain(true);
async function obtenerNodoID(req, res) { try {
    const nodo = await Nodo.findByPk(req.params.id);
    return nodo ? res.json({ ok: true, nodo }) : res.status(404).json({ ok: false, msg: 'Nodo no encontrado' });
}
catch (e) {
    return failure(res, e);
} }
async function buscarNodos(req, res) { try {
    const text = String(req.params.datos || '').slice(0, 100);
    const nodos = await Nodo.findAll({ where: { [Op.or]: ['tipo_nodo', 'nombre', 'url', 'puerto'].map(key => ({ [key]: { [Op.like]: '%' + text + '%' } })) }, order: [['id', 'ASC']] });
    return res.json({ ok: true, nodos });
}
catch (e) {
    return failure(res, e);
} }
async function save(req, res) {
    try {
        const data = values(req.body);
        const node = req.params.id ? await Nodo.findByPk(req.params.id) : null;
        if (req.params.id && !node)
            return res.status(404).json({ ok: false, msg: 'Nodo no encontrado' });
        // Conciliar también direcciones antiguas (localhost y puerto embebido) sin alterarlas.
        const duplicates = await Nodo.findAll({ attributes: ['id', 'url', 'puerto'] });
        if (duplicates.some(item => { if (item.id === node?.id)
            return false; try {
            const existing = normalizeAddress(item.toJSON());
            return existing.url === data.url && existing.puerto === data.puerto;
        }
        catch {
            return false;
        } }))
            return res.status(409).json({ ok: false, msg: 'Ya existe un nodo con esa dirección y puerto' });
        const nodo = node ? await node.update(data) : await Nodo.create({ ...data, tiempo: null });
        return res.status(node ? 200 : 201).json({ ok: true, nodo });
    }
    catch (e) {
        return failure(res, e);
    }
}
async function eliminarNodo(req, res) { try {
    const count = await Nodo.destroy({ where: { id: req.params.id } });
    return count ? res.json({ ok: true }) : res.status(404).json({ ok: false, msg: 'Nodo no encontrado' });
}
catch (e) {
    return failure(res, e);
} }
async function registrarConsulta(req, res) { try {
    const nodo = await Nodo.findByPk(req.params.id);
    if (!nodo)
        return res.status(404).json({ ok: false, msg: 'Nodo no encontrado' });
    await nodo.update({ tiempo: new Date() });
    return res.json({ ok: true, tiempo: nodo.tiempo });
}
catch (e) {
    return failure(res, e);
} }
async function debugNodo(req, res) {
    try {
        const node = await Nodo.findByPk(req.params.id);
        if (!node)
            return res.status(404).json({ msg: 'Nodo no encontrado' });
        const address = normalizeAddress(node.toJSON());
        const response = await fetch(address.url + ':' + address.puerto + '/sfmp', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(process.env.SFMP_TOKEN ? { Authorization: 'Bearer ' + process.env.SFMP_TOKEN } : {}) }, body: JSON.stringify({ UID: 0, Type: 'REQUEST', Operation: 'DEBUG', Data: {} }), signal: AbortSignal.timeout(Number(process.env.REQUEST_TIMEOUT || 2500)) });
        if (!response.ok)
            return res.status(502).json({ msg: 'El proceso rechazó la consulta de estado' });
        return res.json(await response.json());
    }
    catch {
        return res.status(502).json({ msg: 'El proceso no responde o su dirección no es válida' });
    }
}
module.exports = { obtenerNodos, obtenerNodosOrdenados, obtenerNodoID, buscarNodos, crearNodo: save, actualizarNodo: save, eliminarNodo, registrarConsulta, debugNodo };
