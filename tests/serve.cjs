const path = require('path');
const { app } = require('../backend/miback/index');
const express = require('../backend/miback/node_modules/express');
const site = process.argv[2] || path.join(__dirname, '../frontend/starter/dist/fuse');
app.use(express.static(site));
app.get('*', (req, res) => res.sendFile(path.join(site, 'index.html')));
const server = app.listen(Number(process.env.PREVIEW_PORT || 24500), '127.0.0.1', () => console.log('Vista de pruebas disponible en http://127.0.0.1:' + (process.env.PREVIEW_PORT || 24500)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
