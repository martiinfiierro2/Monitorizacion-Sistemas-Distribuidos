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
app.use('/', require('./r_processor'));
  
// Levantamos el servidor en un puerto
app.listen(parameters.port, function () {
    console.log(`PROCESSOR ${parameters.name} LISTENING PORT ${parameters.port}`);
})
 
// registro en los coordinadores principal y sustituto
const { createSFMPMessage, sendSFMPMessage } = require('../commons/commons');
const Data = {name:parameters.name, 
    url:process.env.LOCAL_URL+':'+parameters.port, 
    capacity: parameters.capacity, 
    preference: parameters.preference};
const registerMessage = createSFMPMessage('REQUEST','REGISTER',Data);

// Se registra en el coordinador principal solo
sendSFMPMessage(parameters.urlCoordinatorMain, registerMessage);
//sendSFMPMessage(parameters.urlCoordinatorSubs, registerMessage);

// función que hace el unregister cuando se recibe un fin de proceso
const unregister = ()=> {
    const unregisterMesage = createSFMPMessage('REQUEST','UNREGISTER',Data);
    sendSFMPMessage(parameters.urlCoordinatorMain, unregisterMesage);
    console.log('Terminado')
}
// Si termina el proceso, hacemos el desregistro
process.on('SIGINT', unregister)
  

