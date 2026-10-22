const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('../frontend/starter/node_modules/typescript');
const rx = require('../frontend/starter/node_modules/rxjs');
const { TestScheduler } = require('../frontend/starter/node_modules/rxjs/testing');

// Exercise the actual service and topology using RxJS's virtual clock. Angular
// only supplies the injectable decorator here; no browser or database is used.
function loadServiceFile(name) {
  const file = path.join(__dirname, '../frontend/starter/src/app/services', name + '.ts');
  const mod = new Module(file);
  mod.require = id => {
    if (id === '@angular/core') return { Injectable: () => target => target };
    if (id === 'rxjs') return rx;
    if (id === './topology') return loadServiceFile('topology');
    throw new Error('Unexpected runtime import: ' + id);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
  }).outputText, file);
  return mod.exports;
}
const { MonitorService } = loadServiceFile('monitor.service');
const config = { espera: { valor: 100 }, map: {}, requestTimeout: 3000 };
const nodes = [
  { id: 1, nombre: 'CM', tipo_nodo: 'Controlador Main', url: 'http://127.0.0.1', puerto: '3000', visible: true, latitud: 38, longitud: 0 },
  { id: 2, nombre: 'BM', tipo_nodo: 'Balanceador Main', url: 'http://127.0.0.1', puerto: '3100', visible: true, latitud: 39, longitud: 1 },
  { id: 3, nombre: 'P', tipo_nodo: 'Procesador', url: 'http://127.0.0.1', puerto: '4001', visible: true, latitud: 40, longitud: 2 }
];
function debug(node, round, processorPort = '4001') {
  return { Data: {
    internalConfig: { urlBalancerMain: 'http://127.0.0.1:3100' },
    balancerList: node.tipo_nodo === 'Procesador' ? [] : [{ url: 'http://127.0.0.1:' + processorPort, load: 100 }],
    processorsList: [], receivedMessages: round
  } };
}
const online = snapshot => snapshot.nodes.filter(node => node.status).length;
const edges = snapshot => snapshot.links.map(link => link.source + '>' + link.target).sort();
function service(api, interval = 100) {
  return new MonitorService(api, { getConfig: () => rx.of({ ...config, espera: { valor: interval } }) });
}
function virtual(run) {
  const scheduler = new TestScheduler(assert.deepEqual);
  const subscriptions = new rx.Subscription();
  try {
    scheduler.run(helpers => run({ ...helpers, scheduler, track: sub => { subscriptions.add(sub); return sub; } }));
  } finally {
    // A failed assertion must also cancel the periodic monitor.
    subscriptions.unsubscribe();
  }
}

test('el refresco conserva la ronda anterior y publica todos los nodos juntos, en orden', () => {
  virtual(({ cold, scheduler, track }) => {
    let round = 0, current;
    const outputs = [];
    const api = {
      getNodosOrdenados: () => { round++; return rx.of({ nodos: nodes }); },
      readNodeDebug: node => cold(`${round === 1 ? [15, 8, 20][node.id - 1] : [5, 12, 80][node.id - 1]}ms (a|)`, { a: debug(node, round) })
    };
    const sub = track(service(api).watch(new rx.Subject()).subscribe(value => { current = value; outputs.push({ time: scheduler.now(), value }); }));
    scheduler.schedule(() => {
      assert.equal(online(current), 3);
      assert.deepEqual(edges(current), ['1>2', '2>3']);
      assert(current.nodes.every(n => n.datos.Data.receivedMessages === 1));
      assert.equal(outputs.length, 1, 'Una ronda incompleta no debe publicarse');
    }, 145);
    scheduler.schedule(() => sub.unsubscribe(), 195);
    scheduler.schedule(() => {
      assert.deepEqual(outputs.map(o => o.time), [20, 180]);
      assert.deepEqual(current.nodes.map(n => n.nodo.id), [1, 2, 3]);
      assert(current.nodes.every(n => n.datos.Data.receivedMessages === 2 && !n.pending));
    }, 196);
  });
});

test('una caída real se publica al terminar la consulta y la siguiente ronda recupera el nodo', () => {
  virtual(({ cold, scheduler, track }) => {
    let round = 0, current;
    const outputs = [];
    const api = {
      getNodosOrdenados: () => { round++; return rx.of({ nodos: nodes }); },
      readNodeDebug: node => round === 2 && node.id === 3
        ? cold('60ms #', {}, { name: 'TimeoutError' })
        : cold('10ms (a|)', { a: debug(node, round) })
    };
    const sub = track(service(api).watch(new rx.Subject()).subscribe(value => { current = value; outputs.push(value); }));
    scheduler.schedule(() => assert.equal(online(current), 3), 140);
    scheduler.schedule(() => {
      assert.equal(online(current), 2);
      assert.deepEqual(edges(current), ['1>2']);
      assert.match(current.nodes[2].error, /Tiempo de espera agotado/);
      assert(current.nodes[2].lastSeen);
    }, 170);
    scheduler.schedule(() => {
      assert.equal(online(current), 3);
      assert.deepEqual(edges(current), ['1>2', '2>3']);
      assert.equal(outputs.length, 3);
      sub.unsubscribe();
    }, 220);
  });
});

test('cambios de destino y catálogo se publican juntos; un catálogo vacío retira todos los nodos', () => {
  virtual(({ cold, scheduler, track }) => {
    let round = 0, current;
    const changed = [nodes[0], nodes[1], { ...nodes[2], id: 4, nombre: 'P nuevo', puerto: '4002' }];
    const api = {
      getNodosOrdenados: () => { round++; return rx.of({ nodos: round === 1 ? nodes : round === 2 ? changed : [] }); },
      readNodeDebug: node => cold(`${round === 2 && node.id === 4 ? 70 : 10}ms (a|)`, { a: debug(node, round, round === 2 ? '4002' : '4001') })
    };
    const sub = track(service(api).watch(new rx.Subject()).subscribe(value => current = value));
    scheduler.schedule(() => {
      assert.deepEqual(current.nodes.map(n => n.nodo.nombre), ['CM', 'BM', 'P']);
      assert.deepEqual(edges(current), ['1>2', '2>3']);
    }, 140);
    scheduler.schedule(() => {
      assert.deepEqual(current.nodes.map(n => n.nodo.nombre), ['CM', 'BM', 'P nuevo']);
      assert.equal(current.nodes[2].endpoint, 'http://127.0.0.1:4002');
      assert.deepEqual(edges(current), ['1>2', '2>4']);
    }, 180);
    scheduler.schedule(() => {
      assert.deepEqual(current.nodes, []);
      assert.deepEqual(current.links, []);
      sub.unsubscribe();
    }, 210);
  });
});

test('un error del catálogo conserva la ronda confirmada y el temporizador se recupera', () => {
  virtual(({ cold, scheduler, track }) => {
    let round = 0, current;
    const api = {
      getNodosOrdenados: () => ++round === 2 ? rx.throwError(() => ({ status: 503, error: { msg: 'Catálogo temporalmente no disponible' } })) : rx.of({ nodos: nodes }),
      readNodeDebug: node => cold('10ms (a|)', { a: debug(node, round) })
    };
    const sub = track(service(api).watch(new rx.Subject()).subscribe(value => current = value));
    scheduler.schedule(() => {
      assert.equal(current.stale, true);
      assert.equal(online(current), 3);
      assert.deepEqual(edges(current), ['1>2', '2>3']);
      assert.match(current.error, /Catálogo temporalmente/);
    }, 150);
    scheduler.schedule(() => {
      assert(!current.stale && !current.error);
      assert(current.nodes.every(n => n.datos.Data.receivedMessages === 3));
      sub.unsubscribe();
    }, 220);
  });
});

test('no se solapan rondas, el botón actualiza y cancelar descarta respuestas pendientes', () => {
  virtual(({ cold, scheduler, track }) => {
    let round = 0;
    const outputs = [], refresh = new rx.Subject();
    const api = {
      getNodosOrdenados: () => { round++; return rx.of({ nodos: nodes }); },
      readNodeDebug: node => cold(`${round === 1 ? 20 : 80}ms (a|)`, { a: debug(node, round) })
    };
    const sub = track(service(api).watch(refresh).subscribe(value => outputs.push(value)));
    scheduler.schedule(() => refresh.next(), 40);
    scheduler.schedule(() => refresh.next(), 50);
    scheduler.schedule(() => {
      assert.equal(round, 2);
      assert.equal(outputs.length, 1);
      sub.unsubscribe();
    }, 110);
    scheduler.schedule(() => {
      assert.equal(round, 2);
      assert.equal(outputs.length, 1, 'La ronda cancelada no puede sustituir la última ronda confirmada');
    }, 250);
  });
});

test('un catálogo de 18 nodos espera también a los que están en cola sin superar ocho consultas', () => {
  virtual(({ cold, scheduler, track }) => {
    const catalog = Array.from({ length: 18 }, (_, index) => ({ ...nodes[2], id: index + 1, nombre: 'P' + index, puerto: String(4000 + index) }));
    let active = 0, maximum = 0;
    const outputs = [];
    const api = {
      getNodosOrdenados: () => rx.of({ nodos: catalog }),
      readNodeDebug: node => cold('10ms (a|)', { a: debug(node, 1) }).pipe(
        rx.tap({ subscribe: () => { active++; maximum = Math.max(maximum, active); }, complete: () => active-- })
      )
    };
    const sub = track(service(api, 1000).watch(new rx.Subject()).subscribe(value => outputs.push({ time: scheduler.now(), value })));
    scheduler.schedule(() => { assert.equal(active, 2); assert.equal(outputs.length, 0); }, 25);
    scheduler.schedule(() => {
      assert.equal(maximum, 8);
      assert.equal(active, 0);
      assert.equal(outputs.length, 1);
      assert.equal(outputs[0].time, 30);
      assert.equal(online(outputs[0].value), 18);
      assert.deepEqual(outputs[0].value.nodes.map(node => node.nodo.id), catalog.map(node => node.id));
      sub.unsubscribe();
    }, 35);
  });
});
