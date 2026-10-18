const test = require('node:test'), assert = require('node:assert/strict');
process.env.API_TOKEN = 'test-token';
const { app } = require('../index'), { Nodo } = require('../models/nodo');
test('API: acceso, validación, catálogo vacío, CRUD y fecha independiente', { timeout: 10000 }, async () => {
    const originals = Object.fromEntries(['findAll', 'findByPk', 'create', 'destroy'].map(key => [key, Nodo[key]]));
    let rows = [], nextId = 1;
    const entity = data => Object.assign(data, { toJSON() { const { toJSON, update, ...values } = this; return values; }, async update(values) { Object.assign(this, values); return this; } });
    Nodo.findAll = async (options) => options?.where ? [] : rows;
    Nodo.findByPk = async (id) => rows.find(row => row.id === Number(id));
    Nodo.create = async (data) => { const node = entity({ ...data, id: nextId++ }); rows.push(node); return node; };
    Nodo.destroy = async (options) => { const before = rows.length; rows = rows.filter(r => r.id !== Number(options.where.id)); return before - rows.length; };
    const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const request = (url, method = 'GET', data, token = 'test-token') => fetch(base + '/api' + url, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    try {
        assert.equal((await request('/nodos', 'GET', undefined, 'wrong')).status, 401);
        assert.equal((await request('/nodo', 'POST', {})).status, 400);
        const node = { tipo_nodo: 'Procesador', nombre: 'test', url: 'http://localhost:4002', puerto: '4002', latitud: 38, longitud: 0, visible: false, orden: 1 };
        assert.equal((await request('/nodo', 'POST', { ...node, latitud: 91 })).status, 400);
        assert.equal((await request('/nodo', 'POST', { ...node, tipo_nodo: 'Otro' })).status, 400);
        assert.equal((await request('/nodo', 'POST', { ...node, puerto: '4003' })).status, 400);
        const created = await request('/nodo', 'POST', node);
        assert.equal(created.status, 201);
        const { nodo } = await created.json();
        assert.equal(nodo.url, 'http://127.0.0.1');
        assert.equal(nodo.visible, false);
        assert.equal((await request('/nodo', 'POST', node)).status, 409);
        assert.deepEqual((await (await request('/nodos/no-match')).json()).nodos, []);
        assert.equal((await request('/nodo/' + nodo.id, 'PUT', { ...node, nombre: 'edited' })).status, 200);
        assert.equal((await request('/nodo/' + nodo.id, 'GET')).status, 200);
        assert.equal((await request('/nodo/' + nodo.id + '/consulta', 'PATCH', {})).status, 200);
        assert.equal((await request('/nodo/' + nodo.id, 'DELETE')).status, 200);
        assert.equal((await request('/nodo/' + nodo.id)).status, 404);
    }
    finally {
        await new Promise(resolve => server.close(resolve));
        for (const [key, value] of Object.entries(originals))
            Nodo[key] = value;
    }
});
