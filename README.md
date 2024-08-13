# Proyecto User Auth0

Una aplicación Node.js para manejar la autenticación y la sincronización de usuarios entre una base de datos MySQL y Auth0.

## Tabla de Contenidos

-   [Instalación](#instalación)
-   [Uso](#uso)
-   [Características](#características)
-   [Rutas de la API](#rutas-de-la-api)
-   [Contribución](#contribución)
-   [Licencia](#licencia)

## Instalación

1. Clona el repositorio:
    ```bash
    git clone https://github.com/tu-usuario/proyect-user-auth0.git
    cd proyect-user-auth0
    ```
2. Instala las dependencias:
    ```bash
    npm install
    ```
3. Crea un archivo `.env` en la raíz del proyecto con las siguientes variables de entorno:
    ```env
    PORT=3000
    DB_HOST=your_db_host
    DB_USER=your_db_user
    DB_PASS=your_db_password
    DB_NAME=your_db_name
    AUTH0_DOMAIN=your_auth0_domain
    AUTH0_CLIENT_ID=your_auth0_client_id
    AUTH0_CLIENT_SECRET=your_auth0_client_secret
    AUTH0_AUDIENCE=your_auth0_audience
    ```
4. Inicia el servidor:
    ```bash
    npm start
    npm run dev
    ```

## Uso

Subir archivos CSV y sincronizar usuarios con Auth0.

1. Crear las tablas en MySQL:
    ```bash
    # Crear tabla de usuarios
    GET /users/create-table-users
    ```

# Crear tabla de usuarios Auth0

GET /users/create-table-auth0-users

````

2. Subir un archivo CSV con los usuarios:
```bash
# Subir archivo CSV para tabla 'user'
POST /users/upload-file

# Subir archivo CSV para tabla 'auth0_user'
POST /users/upload-file-auth0
````

Otras rutas
### Listar usuarios: GET /users
### Buscar usuario en Auth0 por email: GET /users/auth0-search?email={email}
### Buscar usuario en MySQL por email o DNI: GET /users/search?email={email}&dni={dni}
### Filtrar y encontrar coincidencias entre las tablas: GET /users/filter-and-find
### Actualizar metadata de usuarios en Auth0: GET /users/update-metadata
### Limpiar tabla user: POST /users/clear-table
### Limpiar tabla auth0_user: POST /users/clear-table-auth0

Características
1. Sincronización de usuarios entre una base de datos MySQL y Auth0.
2. Subida de archivos CSV para poblar las tablas de usuarios.
3. Búsqueda y actualización de usuarios en Auth0.
4. Funcionalidades para crear y limpiar tablas en la base de datos.
5. Rutas de la API
6. Crear tablas
### GET /users/create-table-users: Crear la tabla user en MySQL.
### GET /users/create-table-auth0-users: Crear la tabla auth0_user en MySQL.
Subir archivos CSV
### POST /users/upload-file: Subir archivo CSV para la tabla user.
### POST /users/upload-file-auth0: Subir archivo CSV para la tabla auth0_user.
Obtener y buscar usuarios
### GET /users: Obtener todos los usuarios de la tabla user.
### GET /users/auth0-search: Buscar usuario en Auth0 por email.
### GET /users/search: Buscar usuario en MySQL por email o DNI.
### GET /users/filter-and-find: Filtrar la tabla user y encontrar coincidencias en la tabla auth0_user.
Actualizar metadata y limpiar tablas
### GET /users/update-metadata?limit=100&offset=0: Actualizar metadata de usuarios en Auth0 con paginacion.
### POST /users/clear-table: Limpiar la tabla user en MySQL.
### POST /users/clear-table-auth0?limit=100&offset=0: Limpiar la tabla auth0_user en MySQL con paginacion.

