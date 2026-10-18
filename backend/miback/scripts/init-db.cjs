const path = require('path'), fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../database/conexionDB');
const { normalizeAddress } = require('../middleware/node-validation');
(async () => {
    try {
        await db.authenticate();
        await db.query(fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8').replace(/^\ufeff/, ''));
        const [rows] = await db.query('SELECT id,url,puerto FROM nodos');
        const keys = new Set();
        for (const row of rows) {
            const n = normalizeAddress(row);
            const key = n.url + ':' + n.puerto;
            if (keys.has(key))
                throw new Error('Hay destinos duplicados; revisa el catálogo antes de añadir la restricción única');
            keys.add(key);
        }
        const [indexes] = await db.query("SHOW INDEX FROM nodos WHERE Key_name = 'nodos_endpoint_unique'");
        if (!indexes.length)
            await db.query('ALTER TABLE nodos ADD UNIQUE KEY nodos_endpoint_unique (url, puerto)');
        if (process.argv.includes('--seed')) {
            if (rows.length)
                throw new Error('La semilla solo se permite sobre un catálogo vacío');
            const { Nodo } = require('../models/nodo');
            const groups = [{ c: 3000, b: 3100, p: [4001, 4002, 4003] }, { c: 5000, b: 4100, p: [5002, 5003, 5004] }];
            const nodes = groups.flatMap((g, i) => [['Controlador Main', 'CM', g.c], ['Controlador Subs', 'CS', g.c + 1], ['Balanceador Main', 'BM', g.b], ['Balanceador Subs', 'BS', g.b + 1], ...g.p.map((port, j) => ['Procesador', 'P' + (i * 3 + j + 1) + '-', port])].map(([tipo_nodo, name, port], j) => ({ tipo_nodo, nombre: name + (i + 1), url: 'http://127.0.0.1', puerto: String(port), latitud: 38 + i + j * .02, longitud: -.5 + i, visible: true, orden: i * 10 + j })));
            await Nodo.bulkCreate(nodes);
        }
        console.log('Esquema preparado. No se han borrado registros.');
    }
    catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
    finally {
        await db.close();
    }
})();
