const usersRouter = require('express').Router();
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const UsersController = require('../controllers/users');

// Cargar variables de entorno desde el archivo .env
dotenv.config();

// Configuración de almacenamiento para Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Ruta para crear la tabla `user` en MySQL
usersRouter.get('/create-table-users', UsersController.createTableUsers);

// Ruta para crear la tabla `user_filtered` en MySQL
usersRouter.get('/create-table-users-filtered', UsersController.createTableUsersFiltered);

//Ruta para crear la tabla de usuarios Auth0 en MySQL
usersRouter.get('/create-table-auth0-users', UsersController.createTableAuth0);

// Ruta para subir el archivo CSV a la tabla auth0_user
usersRouter.post('/upload-file-auth0', upload.single('file'), UsersController.uploadCSVUserAuth0);

// Ruta para subir el archivo CSV
usersRouter.post('/upload-file', upload.single('file'), UsersController.uploadCSVUser);

// Ruta para leer datos de MySQL
usersRouter.get('/', UsersController.getAllUsers);

// Ruta para buscar usuario en Auth0 por email
usersRouter.get('/auth0-search', UsersController.auth0Search);

//Ruta para buscar usuario en MySQL por email o dni
usersRouter.get('/search', UsersController.search);

// Ruta para filtrar la tabla user y encontrar coincidencias en la tabla auth0_user
usersRouter.get('/filter-and-find', UsersController.filterAndFind);

// Ruta para leer datos de MySQL y buscar en Auth0 para actualizar metadata
usersRouter.get('/update-metadata', UsersController.updateMetadata);

// Ruta para leer datos de MySQL y buscar en Auth0_user para actualizar metadata de genero en Auth0
usersRouter.get('/update-metadata-gender-auth0', UsersController.updateMetadataGenderAuth0);

// Ruta para limpiar la tabla user de MySQL
usersRouter.post('/clear-table', UsersController.clearTable);

// Ruta para limpiar la tabla user filtered de MySQL
usersRouter.post('/clear-table-user-filtered', UsersController.clearTableUserFiltered);

// Ruta para limpiar la tabla auth0_user de MySQL
usersRouter.post('/clear-table-auth0', UsersController.clearTableAuth0);


module.exports = usersRouter;