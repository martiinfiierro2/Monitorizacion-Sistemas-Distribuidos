const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.BD, 'root', process.env.PWDBD, {
    host: 'localhost',
    dialect: 'mysql',
    port: process.env.PORTBD,
});

module.exports = sequelize;