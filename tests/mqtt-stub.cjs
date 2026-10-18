const Module = require('module'), { EventEmitter } = require('events');
const original = Module._load;
Module._load = function (name, ...args) { if (name === 'mqtt')
    return { connect: () => { const client = new EventEmitter(); client.connected = true; client.subscribe = () => { }; client.end = () => { }; process.on('message', message => { if (message.injectMQTT)
            client.emit('message', 'test', Buffer.from(JSON.stringify(message.payload))); }); return client; } }; return original.call(this, name, ...args); };
