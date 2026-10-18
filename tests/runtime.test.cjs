const test = require('node:test'), assert = require('node:assert/strict');
const { fork } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os'), net = require('net');
const root = path.join(__dirname, '..'), sleep = ms => new Promise(r => setTimeout(r, ms));
async function port() { return new Promise(resolve => { const server = net.createServer(); server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); }); }); }
async function eventually(check, label) { for (let i = 0; i < 80; i++) {
    try {
        if (await check())
            return;
    }
    catch { }
    await sleep(100);
} assert.fail(label || 'Estado esperado no alcanzado'); }
test('registro, sustitución, entrega, retirada de caídos, recuperación e idempotencia', { timeout: 40000 }, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-runtime-')), children = [];
    const [bm, bs, cm, cs, p1, p2, late, lateC] = await Promise.all(Array.from({ length: 8 }, () => port()));
    const url = p => 'http://127.0.0.1:' + p;
    const env = { ...process.env, DATA_DIR: dir, AYASENDTIME: '200', AYAMAXSENDS: '2', REQUEST_TIMEOUT: '200', REGISTER_INTERVAL: '250', MQTT_ENABLED: 'true', TTN_APP_ID: 'test', TTN_ACCESS_KEY: 'test', SFMP_TOKEN: '', LOCAL_URL: 'http://127.0.0.1' };
    function start(role, args) { const child = fork(path.join(root, 'backend/v2', role, role + '.js'), args.map(String), { cwd: path.join(root, 'backend/v2'), execArgv: ['--require', path.join(__dirname, 'mqtt-stub.cjs')], env, silent: true }); child.logs = ''; child.stdout.on('data', b => child.logs += b); child.stderr.on('data', b => child.logs += b); children.push(child); return child; }
    async function request(port, Operation = 'DEBUG', Data = {}) { const r = await fetch(url(port) + '/sfmp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ UID: 0, Type: 'REQUEST', Operation, Data }), signal: AbortSignal.timeout(1000) }); assert.equal(r.status, 200); return (await r.json()).Data; }
    try {
        let mainB = start('balancer', [bm, 'main']);
        const subB = start('balancer', [bs, 'subs', url(bm)]);
        let mainC = start('coordinator', [cm, url(bm), url(bs), 'main']);
        start('coordinator', [cs, url(bm), url(bs), 'subs', url(cm)]);
        await eventually(async () => Boolean((await request(cm)).internalConfig));
        const first = start('processor', ['first', p1, 100, 1, url(cm), url(cs)]);
        const second = start('processor', ['second', p2, 100, 0.5, url(cm), url(cs)]);
        await eventually(async () => (await request(cm)).processorsList.length === 2, 'registro de ambos procesadores');
        await eventually(async () => (await request(cs)).processorsList.length === 2, 'replicación');
        mainB.send({ injectMQTT: true, payload: { stage: 'normal' } });
        await eventually(async () => first.logs.includes('normal'), 'entrega normal');
        mainB.kill('SIGKILL');
        mainC.kill('SIGKILL');
        await eventually(async () => (await request(cs)).coordinatorSubsActive && (await request(bs)).balancerSubsActive, 'asunción del sustituto');
        first.kill('SIGKILL');
        await new Promise(resolve => first.once('exit', resolve));
        subB.send({ injectMQTT: true, payload: { stage: 'while-stale' } });
        await eventually(async () => { const d = await request(cs); return d.processorsList.length === 1 && d.processorsList[0].name === 'second'; }, 'el sustituto retira al procesador caído');
        await eventually(async () => { const d = await request(bs); return d.balancerList.length === 1 && d.balancerList[0].name === 'second'; }, 'reconfiguración de destinos');
        subB.send({ injectMQTT: true, payload: { stage: 'survivor' } });
        await eventually(async () => second.logs.includes('while-stale'), 'conserva la entrega pendiente durante la retirada del procesador caído');
        await eventually(async () => second.logs.includes('survivor'), 'entrega al superviviente');
        assert((await request(bs)).balancerMainMaxAYA >= 0);
        const message = { UID: 'dedup-test', Origin: 'test', Data: 'one' };
        for (let i = 0; i < 2; i++) {
            const r = await fetch(url(p2) + '/msg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
            assert.equal(r.status, 200);
            assert.equal((await r.json()).UID, message.UID);
        }
        assert.equal((await request(p2)).duplicates, 1);
        mainB = start('balancer', [bm, 'main']);
        mainC = start('coordinator', [cm, url(bm), url(bs), 'main']);
        await eventually(async () => !(await request(cs)).coordinatorSubsActive && !(await request(bs)).balancerSubsActive, 'recuperación de principales');
        await eventually(async () => (await request(cm)).processorsList.some(p => p.name === 'second'), 'recuperación del registro');
        start('processor', ['late', late, 100, 0, url(lateC), url(lateC)]);
        await sleep(400);
        start('coordinator', [lateC, url(bm), url(bs), 'main']);
        await eventually(async () => (await request(lateC)).processorsList.some(p => p.name === 'late'), 'reintento de registro fuera de orden con preferencia cero');
    }
    finally {
        for (const child of children)
            child.kill();
        await sleep(250);
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
