const { spawn } = require('child_process'), path = require('path');
const root = path.join(__dirname, '..'), children = [];
let stopping = false;
function stop() { if (stopping)
    return; stopping = true; for (const child of children)
    child.kill(); }
function start(file, args, cwd, extra = {}) {
    const child = spawn(process.execPath, [path.join(root, file), ...args], { cwd: path.join(root, cwd), env: { ...process.env, ...extra }, stdio: 'inherit' });
    children.push(child);
    child.on('exit', code => { if (!stopping && code) {
        console.error('Un servicio terminó con error:', code);
        stop();
        process.exitCode = code;
    } });
    return child;
}
start('backend/miback/index.js', [], 'backend/miback');
start('frontend/starter/node_modules/@angular/cli/bin/ng.js', ['serve', '--proxy-config', 'proxy.conf.json', '--host', '127.0.0.1'], 'frontend/starter');
if (process.argv.includes('--demo')) {
    for (const group of [{ c: 3000, b: 3100, ports: [4001, 4002, 4003], prefix: 'process' }, { c: 5000, b: 4100, ports: [5002, 5003, 5004], prefix: 'group2-process' }]) {
        const env = { MQTT_ENABLED: 'false' };
        start('backend/v2/balancer/balancer.js', [String(group.b), 'main'], 'backend/v2', env);
        start('backend/v2/balancer/balancer.js', [String(group.b + 1), 'subs', 'http://127.0.0.1:' + group.b], 'backend/v2', env);
        start('backend/v2/coordinator/coordinator.js', [String(group.c), 'http://127.0.0.1:' + group.b, 'http://127.0.0.1:' + (group.b + 1), 'main'], 'backend/v2', env);
        start('backend/v2/coordinator/coordinator.js', [String(group.c + 1), 'http://127.0.0.1:' + group.b, 'http://127.0.0.1:' + (group.b + 1), 'subs', 'http://127.0.0.1:' + group.c], 'backend/v2', env);
        group.ports.forEach((port, i) => start('backend/v2/processor/processor.js', [group.prefix + (i + 1), String(port), '100', String(1 - i * .25), 'http://127.0.0.1:' + group.c, 'http://127.0.0.1:' + (group.c + 1)], 'backend/v2', env));
    }
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);
