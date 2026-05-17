const { Nodo } = require('../models/nodo');
const { Op } = require('sequelize');

const obtenerNodos = async(req, res) => {
    try{
        let nodos;

        nodos = await Nodo.findAll();
        
        return res.json({
            ok: true,
            msg: 'getNodos',
            nodos: nodos,
        });
    }catch (error) {
        return res.status(500).json({
            ok: false,
            msg: 'Error en get all nodos',
            error: error
        });
    }
};

const obtenerNodosOrdenados = async(req, res) => {
    try{
        let nodos;

        nodos = await Nodo.findAll({
            order: [['orden', 'ASC']],
        });
        
        return res.json({
            ok: true,
            msg: 'getNodosOrdenados',
            nodos: nodos,
        });
    }catch (error) {
        return res.status(500).json({
            ok: false,
            msg: 'Error al recuperar los nodos por orden',
            error: error
        });
    }
};

const obtenerNodoID = async(req, res) => {
    try{
        let id = req.params.id;
        let nodo = await Nodo.findOne({ where: { id: id }});;

        if (!nodo){
            return res.status(404).json({
              ok: false,
              msg: `Nodo con id ${id} no existe`,
            });
        }
      
        return res.json({
            ok: true,
            msg: 'getNodoID',
            nodo: nodo,
        });
    }catch (error) {
        return res.status(500).json({
            ok: false,
            msg: 'Error en get nodo ID',
            error: error
        });
    }
};

const buscarNodos = async(req, res) => {
    const datos = req.params.datos;

    try{
        let nodos = await Nodo.findAll({
            where: {
                [Op.or]: [
                    { tipo_nodo: { [Op.like]: `%${datos}%` } },
                    { nombre: { [Op.like]: `%${datos}%` } },
                    { puerto: { [Op.like]: `%${datos}%` } },
                ],
            },
        });

        if (nodos.length === 0) {
            return res.status(404).json({
                ok: false,
                msg: 'No se encontraron nodos con esos parámetros de búsqueda.',
            });
        }

        res.json({
            ok: true,
            msg: 'buscarNodos',
            nodos: nodos
        });
    }catch (error) {
        return res.status(400).json({
            ok: false,
            msg: 'Error buscando nodos',
            error: error.message
        });
    }
}

const crearNodo = async (req, res) => {
    try {
        let nodo = await Nodo.findOne({
            where: {
                url: req.body.url,
                puerto: req.body.puerto
            }
        });

        if (!nodo) {
            let newNodo = await Nodo.create(req.body);
            return res.status(200).json({
                ok: true,
                msg: 'Nodo creado correctamente',
                nodo: newNodo
            });
        } else{
            return res.status(409).json({
                ok: false,
                msg: `Ya existe un nodo con url ${req.body.url} y puerto ${req.body.puerto}`
            });
        }
    } catch (error) {
        return res.status(500).json({
            ok: false,
            msg: 'Error creando el nodo',
            error: error.message
        });
    }
}

const actualizarNodo = async (req, res) => {
    try {
        let id = req.params.id
        let { tipo_nodo, nombre, url, puerto, latitud, longitud, visible, tiempo, orden } = req.body;
        let nodo = await Nodo.findByPk(id);

        if (nodo) {
            let comprobacionTNyN = await Nodo.findOne({
                where: {
                    id: { [Op.ne]: id },
                    url: req.body.url,
                    puerto: req.body.puerto
                }
            })
            if(!comprobacionTNyN){
                await nodo.update({
                    tipo_nodo: tipo_nodo,
                    nombre: nombre,
                    url: url,
                    puerto: puerto,
                    latitud: latitud,
                    longitud: longitud,
                    visible: visible,
                    tiempo: tiempo,
                    orden: orden
                });
                return res.status(200).json({
                    ok: true,
                    msg: 'Nodo actulizado correctamente',
                    nodo: nodo
                });
            } else{
                return res.status(409).json({
                    ok: false,
                    msg: `Ya existe un nodo con url ${req.body.url} y puerto ${req.body.puerto}`
                });
            }
        } else {
            return res.status(404).json({
                ok: false,
                msg: 'Nodo no encontrado'
            });
        }
    } catch (error) {
        return res.status(500).json({
            ok: false,
            msg: 'Error actualizando el nodo',
            error: error.message
        });
    }
}



module.exports = { obtenerNodos,obtenerNodosOrdenados, obtenerNodoID, buscarNodos, crearNodo, actualizarNodo };