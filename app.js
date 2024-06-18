const express = require('express');
const fs = require('fs');
const dotenv = require('dotenv');
const usersRouter = require('./routes/users');

// Cargar variables de entorno desde el archivo .env
dotenv.config();
const app = express();
const port = process.env.PORT ?? 3000;

// Crear carpeta de uploads si no existe
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/users', usersRouter);

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
