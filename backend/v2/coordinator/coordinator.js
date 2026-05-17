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
app.use('/', require('./r_coordinator'));

// Levantamos el servidor en un puerto
app.listen(parameters.port, function () {
    console.log(`COORDINATOR ${parameters.type} LISTENING PORT ${parameters.port}`);
})

// Activamos la comprobación de AYA
const { activateAYA, activateUPDATECONFIG } = require('./c_coordinator')

activateAYA();
activateUPDATECONFIG();

