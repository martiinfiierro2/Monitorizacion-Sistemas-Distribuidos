const test = require('node:test'), assert = require('node:assert/strict');
const ts = require('../frontend/starter/node_modules/typescript'), fs = require('fs'), path = require('path'), Module = require('module');
const file = path.join(__dirname, '../frontend/starter/src/app/services/topology.ts');
const mod = new Module(file);
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { buildTopology, normalizeEndpoint, validCoordinates, validDebug } = mod.exports;
function fixture() {
    const types = ['Controlador Main', 'Controlador Subs', 'Balanceador Main', 'Balanceador Subs', 'Procesador'];
    return types.map((tipo_nodo, i) => ({ nodo: { id: i, nombre: ['CM', 'CS', 'BM', 'BS', 'P'][i], tipo_nodo, url: 'http://127.0.0.1', puerto: String(3000 + i), visible: true, latitud: 38, longitud: 0 }, endpoint: 'http://127.0.0.1:' + (3000 + i), status: true, datos: { Data: { internalConfig: { urlBalancerMain: 'http://127.0.0.1:3002', urlBalancerSubs: 'http://127.0.0.1:3003', urlMain: i === 3 ? 'http://127.0.0.1:3002' : '', urlCoordinatorlMain: i === 1 ? 'http://127.0.0.1:3000' : '' }, balancerList: [{ url: 'http://127.0.0.1:3004' }], processorsList: [], balancerSubsActive: false, coordinatorSubsActive: false } } }));
}
const edges = states => buildTopology(states).links.map(l => l.source + '>' + l.target).sort();
test('topología normal, caídas y rol confirmado del sustituto', () => {
    const s = fixture();
    assert.deepEqual(edges(s), ['0>2', '1>0', '2>4', '3>2']);
    s[2].status = false;
    assert.deepEqual(edges(s), ['1>0']);
    s[3].datos.Data.balancerSubsActive = true;
    assert.deepEqual(edges(s), ['0>3', '1>0', '3>4']);
    s[0].status = false;
    assert.deepEqual(edges(s), ['3>4']);
    s[1].datos.Data.coordinatorSubsActive = true;
    assert.deepEqual(edges(s), ['1>3', '3>4']);
});
test('un nodo caído u oculto no conserva enlaces y el catálogo puede estar vacío', () => {
    const s = fixture();
    s[4].status = false;
    assert(!edges(s).includes('2>4'));
    s[4].status = true;
    s[4].nodo.visible = false;
    assert(!edges(s).includes('2>4'));
    assert.deepEqual(edges([]), []);
});
test('sustitución funciona aunque no exista ficha del principal', () => {
    const s = fixture();
    s[3].datos.Data.balancerSubsActive = true;
    assert.deepEqual(edges(s.filter(n => n.nodo.id !== 2)), ['0>3', '1>0', '3>4']);
    s[1].datos.Data.coordinatorSubsActive = true;
    assert.deepEqual(edges(s.filter(n => ![0, 2].includes(n.nodo.id))), ['1>3', '3>4']);
});
test('normaliza puertos embebidos, localhost e IPv6 loopback sin concatenarlos', () => {
    assert.equal(normalizeEndpoint('http://localhost:4002', '4002'), 'http://127.0.0.1:4002');
    assert.equal(normalizeEndpoint('http://[::1]:4002'), 'http://127.0.0.1:4002');
    assert.throws(() => normalizeEndpoint('http://localhost:4003', '4002'));
    assert.throws(() => normalizeEndpoint('javascript:alert(1)'));
    const s = fixture();
    s[4].endpoint = normalizeEndpoint('http://localhost:3004');
    assert(edges(s).includes('2>4'));
});
test('rechaza DEBUG y coordenadas inválidas sin romper la topología', () => {
    const s = fixture();
    assert.equal(validDebug(s[2].nodo, {}), false);
    assert.equal(validCoordinates({ ...s[4].nodo, latitud: 'bad' }), false);
    assert.equal(validCoordinates({ ...s[4].nodo, longitud: 181 }), false);
    s[4].nodo.tipo_nodo = 'Otro';
    s[4].status = false;
    assert(buildTopology(s).warnings.some(w => w.includes('tipo desconocido')));
});
