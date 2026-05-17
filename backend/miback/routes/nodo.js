const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos } = require('../middleware/validar-campos');
const { obtenerNodos, obtenerNodosOrdenados, obtenerNodoID, crearNodo , actualizarNodo, buscarNodos} = require('../controllers/nodo');

const router = Router(); //Declaramos un router de tipo Router

//get all nodos
router.get('/nodos', obtenerNodos);

//get all nodos
router.get('/nodosOrden', obtenerNodosOrdenados);

//get nodo
router.get('/nodo/:id', obtenerNodoID);

//buscar nodos
router.get('/nodos/:datos', buscarNodos);

router.post('/nodo', [
    check('tipo_nodo', "El tipo de nodo está vacío").not().isEmpty(),
    check('nombre', "El nombre está vacío").not().isEmpty(),
    check('url', "La url está vacía").not().isEmpty(),
    check('puerto', "El puerto está vacío").not().isEmpty(),
    check('latitud', "La latitud está vacía").not().isEmpty(),
    check('longitud', "La longitud está vacía").not().isEmpty(),
    check('visible', "El campo visible está vacío").not().isEmpty(),
    validarCampos,
], crearNodo);

router.put('/nodo/:id', [
    check('tipo_nodo', "El tipo de nodo está vacío").not().isEmpty(),
    check('nombre', "El nombre está vacío").not().isEmpty(),
    check('url', "La url está vacía").not().isEmpty(),
    check('puerto', "El puerto está vacío").not().isEmpty(),
    check('latitud', "La latitud está vacía").not().isEmpty(),
    check('longitud', "La longitud está vacía").not().isEmpty(),
    check('visible', "El campo visible está vacío").not().isEmpty(),
    validarCampos,
], actualizarNodo);

module.exports = router; // Exportamos el objeto router para que se pueda usar fuera del modulo