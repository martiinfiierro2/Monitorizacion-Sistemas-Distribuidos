const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { DeliveryQueue } = require('../backend/v2/balancer/delivery');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(check) { for (let i = 0; i < 100; i++) {
    if (check())
        return;
    await sleep(10);
} assert.fail('La entrega no terminó'); }
function queue(deliver, options = {}) { return new DeliveryQueue({ deliver, ...options }); }
test('aplica pesos 90/10 y soporta reducir destinos', async () => {
    const counts = { a: 0, b: 0 };
    const q = queue(async (target) => counts[target.url]++);
    try {
        q.configure([{ url: 'a', load: 90 }, { url: 'b', load: 10 }]);
        for (let i = 0; i < 10; i++)
            q.enqueue({ UID: String(i) });
        await until(() => q.status().pending === 0);
        assert.deepEqual(counts, { a: 9, b: 1 });
        q.configure([{ url: 'b', load: 100 }]);
        q.enqueue({ UID: 'after-shrink' });
        await until(() => q.status().pending === 0);
        assert.equal(counts.b, 2);
    }
    finally {
        q.stop();
    }
});
test('reintenta otro destino y conserva el UID; no pierde un fallo transitorio', async () => {
    const attempts = [];
    let healthy = false;
    const q = queue(async (target, message) => { attempts.push([target.url, message.UID]); if (target.url === 'a' || !healthy)
        throw Error('offline'); }, { retryMs: 20 });
    try {
        q.configure([{ url: 'a', load: 90 }, { url: 'b', load: 10 }]);
        q.enqueue({ UID: 'stable' });
        await until(() => q.status().failedAttempts >= 2);
        assert.equal(q.status().pending, 1);
        healthy = true;
        await until(() => q.status().pending === 0);
        assert(attempts.every(([, id]) => id === 'stable'));
        assert.equal(q.status().delivered, 1);
    }
    finally {
        q.stop();
    }
});
test('restaura pendientes guardados al reiniciar y notifica cola llena', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-queue-')), file = path.join(dir, 'pending.json');
    const first = queue(async () => { }, { file, limit: 1 });
    first.enqueue({ UID: 'saved' });
    assert.equal(first.enqueue({ UID: 'overflow' }), false);
    assert.equal(first.status().rejected, 1);
    first.stop();
    const delivered = [];
    const second = queue(async (t, m) => delivered.push(m.UID), { file });
    try {
        second.configure([{ url: 'a' }]);
        await until(() => second.status().pending === 0);
        assert.deepEqual(delivered, ['saved']);
        assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), []);
    }
    finally {
        second.stop();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
test('la ventana de carga envejece sin nuevos mensajes', () => {
    const real = Date.now;
    let now = 100000;
    Date.now = () => now;
    const meter = require('../backend/v2/balancer/loadMeter');
    try {
        meter.addMessage();
        assert.equal(meter.messageRate(), .1);
        now += 60000;
        assert.equal(meter.totalMeters(), 0);
        assert.equal(meter.messageRate(), 0);
    }
    finally {
        Date.now = real;
    }
});
