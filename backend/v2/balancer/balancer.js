/**
 * 
 * Componente BALANCER
 * Argumentos
 * node balancer.js port type url_suplente
 * 1.- PORT: puerto por el que escucha el componente
 * 2.- TYPE: main/subs, indica si es componente principal o está como sustituto
 * 3.- URL: url del balanceador principal
 * 
 * nodemon balancer.js 3100 suplente http://127.0.0.1:3000/
 * 
 */

// Cargar variables de entorno
require('dotenv').config();

// Incluirmos la librería de express para levantar una API y CORS
const express = require('express')
const cors = require('cors');

// Metemos body-parser para poder parsear las request que nos llegarán por la API
const bodyParser = require('body-parser');

// Funciones auxiliares
const { parseArgs } = require('./functions')

// Obtenemso los párametros y los validamos o error
const parameters = parseArgs(process.argv);
if (parameters==-1) return

// Creamos la APP y la configuramos para parsear JSON en la request
const app = express()
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());

// atendemos solo peticion post
app.use('/', require('./r_balancer'));

// Levantamos el servidor en un puerto
app.listen(parameters.port, function () {
    console.log(`BALANCER ${parameters.type} LISTENING PORT ${parameters.port}`);
})


// Activa los AYAS
const {activeAYA, connectMQTT} = require('./c_balancer');
const { getInternal } = require('./balancerData');
activeAYA();

// Si soy principal, por defecto activo conexión a MQTT
if (getInternal('type')=='main') connectMQTT();



