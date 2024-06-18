const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// Cargar variables de entorno desde el archivo .env
dotenv.config();

// Configuración de la conexión a la base de datos MySQL
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

// Función para conectarse a la base de datos
async function connectDB() {
    try {
        const connection = await mysql.createConnection(dbConfig);
        console.log('Connected to MySQL');
        return connection;
    } catch (error) {
        console.error('Error connecting to MySQL:', error);
        throw error;
    }
}

module.exports = connectDB;
