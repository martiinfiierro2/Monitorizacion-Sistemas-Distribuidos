const { DataTypes } = require('sequelize');
const sequelize = require('../database/conexionDB'); // Archivo que contiene la configuración de Sequelize y la conexión a la base de datos

const Nodo = sequelize.define('Nodo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    tipo_nodo: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false
    },
    url: {
        type: DataTypes.STRING(100),
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
        allowNull: false,
        defaultValue: true,
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
    indexes: [{ name: 'nodos_endpoint_unique', unique: true, fields: ['url', 'puerto'] }],
});

module.exports = { Nodo }
