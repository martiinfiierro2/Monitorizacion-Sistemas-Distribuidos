const { Sequelize } = require('sequelize');
module.exports = new Sequelize(process.env.BD || 'tfg', process.env.DB_USER || 'root', process.env.PWDBD || '', { host: process.env.DB_HOST || '127.0.0.1', dialect: 'mysql', port: Number(process.env.PORTBD || 3306), logging: false, pool: { max: 5, min: 0 }, dialectOptions: { connectTimeout: 5000 } });
