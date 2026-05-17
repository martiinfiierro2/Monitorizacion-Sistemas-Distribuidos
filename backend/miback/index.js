const express = require('express');
const cors = require('cors');
const logger = require('morgan');

require('dotenv').config()

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(cors());

app.use('/api', require('./routes/nodo'));

app.listen(process.env.PORT, () => {
    console.log('Servidor corriendo en el puerto ', process.env.PORT);
});