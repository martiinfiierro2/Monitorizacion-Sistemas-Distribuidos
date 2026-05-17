const { DataTypes } = require('sequelize');
const sequelize = require('../database/conexionDB'); // Archivo que contiene la configuración de Sequelize y la conexión a la base de datos

const Nodo = sequelize.define('Nodo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    tipo_nodo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    puerto: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    latitud: {
        type: DataTypes.STRING,
        allowNull: true
    },
    longitud: {
        type: DataTypes.STRING,
        allowNull: true
    },
    visible: {
        type: DataTypes.BOOLEAN,
    },
    tiempo: {
        type: DataTypes.DATE,
        allowNull: true
    },
    orden: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
},{
    tableName: 'nodos',
    timestamps: false,
});

module.exports = { Nodo }