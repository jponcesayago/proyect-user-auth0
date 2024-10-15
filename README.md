# API de Gestión de Usuarios con MySQL y Auth0

Esta API permite gestionar usuarios en una base de datos MySQL, incluyendo la creación de tablas, la carga de datos desde archivos CSV y la búsqueda de usuarios tanto en MySQL como en Auth0. A continuación se detallan las rutas disponibles.

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


Rutas de la API
1. Crear Tablas 
Ruta: /users/create-table-users
.Descripción: Crea la tabla user en MySQL si no existe.
Ruta: /users/create-table-users-filtered 
.Descripción: Crea la tabla user_filtered en MySQL si no existe.
Ruta: /users/create-table-auth0-users 
.Descripción: Crea la tabla auth0_user en MySQL si no existe.

2. Cargar Archivos CSV
Ruta: /users/upload-file-auth0

Método: POST
 .Descripción: Carga un archivo CSV a la tabla auth0_user. El
archivo debe incluir las siguientes columnas: first_name, last_name,
gender, birthday, taxvat, taxvat_type, crm_id, Id, Given Name, Family
Name, Nickname, Name, Email, Email Verified, Created At, Updated At.
Ruta: /users/upload-file

Método: POST
 .Descripción: Carga un archivo CSV a la tabla user. El
archivo debe incluir las siguientes columnas: CreatedOn, ContactId,
EMailAddress1, FirstName, LastName, GenderCode, axx_genero, BirthDate,
axx_tipodocumento, axx_nrodocumento, Q susc activas.

3. Leer Datos
 Ruta: /users
 Método: GET
 .Descripción: Lee todos los usuarios de la tabla user.

4. Buscar Usuarios Ruta: /users/auth0-search

Método: GET
 .Descripción: Busca un usuario en Auth0 por su email. Se
requiere el parámetro email. 
Ruta: /users/search

Método: GET
 .Descripción: Busca un usuario en MySQL por email o DNI. Se
requiere al menos uno de los parámetros: email o dni. 

5. Filtrar y Encontrar Usuarios
 Ruta: /users/filter-and-find
 
  Método: GET
.Descripción: Filtra y encuentra usuarios en MySQL y Auth0, ya sea por email o DNI, y
los almacena en la tabla user_filtered. 

6. Actualizar Metadatos
 Ruta: /users/update-metadata
 
 Método: GET
  .Descripción: Lee datos de MySQL y busca en Auth0 para actualizar los metadatos de los usuarios. Utiliza paginación con parámetros limit y offset. Notas Los archivos CSV deben estar correctamente formateados para evitar errores durante la carga de datos. Se implementan logs para el seguimiento de inserciones exitosas y errores durante el proceso de carga y filtrado de usuarios. Se recomienda configurar las credenciales y permisos necesarios para el acceso a la API de Auth0.

