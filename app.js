const express = require('express');
const multer = require('multer');
const mysql = require('mysql');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Cargar variables de entorno desde el archivo .env
dotenv.config();
const app = express();
const port = process.env.PORT ?? 3000;

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

// Crear carpeta de uploads si no existe
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Configuración de la base de datos MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

// Conectar a la base de datos MySQL
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database.');
});

// Configuración de Auth0
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0ClientId = process.env.AUTH0_CLIENT_ID;
const auth0ClientSecret = process.env.AUTH0_CLIENT_SECRET;
const auth0Audience = process.env.AUTH0_AUDIENCE;

// Obtener token de acceso de Auth0
async function getAuth0Token() {
    try {
        const response = await axios.post(`https://${auth0Domain}/oauth/token`, {
            client_id: auth0ClientId,
            client_secret: auth0ClientSecret,
            audience: auth0Audience,
            grant_type: 'client_credentials'
        });
        console.log('Auth0 token:', response.data.access_token);
        return response.data.access_token;
    } catch (error) {
        console.error('Error getting Auth0 token:', error);
    }
}

// Buscar usuario en Auth0 por email
async function getAuth0UserByEmail(token, email) {
    try {
        const response = await axios.get(`https://${auth0Domain}/api/v2/users-by-email`, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            params: {
                email: email
            }
        });
        console.log('Auth0 user by email:', response.data[0]);
        return response.data[0]; // Retorna el primer usuario encontrado
    } catch (error) {
        console.error('Error getting Auth0 user by email:', error);
    }
}

// Función para obtener el género en el formato esperado
function getGender(genderCode) {
    switch (genderCode) {
        case 1:
        case 'masc':
        case 'masculino':
        case 'Masculino':
        case 'MASCULINO':
            return 'Masculino';
        case 2:
        case 'fem':
        case 'femenino':
        case 'Femenino':
        case 'FEMENINO':
            return 'Femenino';
        default:
            return 'Masculino';
    }
}


// Función para obtener todos los registros de la tabla user
async function getAllUsers() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM user';
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error fetching data from user table:', err);
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

//Funcion para obtener todos los registros de la tabla user por su email unico en la tabla de user
async function getAllUsersByUniqueEmail() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM user WHERE email IN (SELECT email FROM user GROUP BY email HAVING COUNT(*) = 1)';
        db.query(query, (err, results) => {
            if (err) {
                console.error('Error fetching data from user table:', err);
                reject(err);
            } else {
                resolve(results);
            }
        });
    }
    );
}

// Función para encontrar un usuario en la tabla auth0_user
async function findMatchingAuth0User(email) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT * FROM auth0_user WHERE Email = ?';
        const values = [email];
        db.query(query, values, (err, results) => {
            if (err) {
                console.error('Error finding matching user in auth0_user table:', err);
                reject(err);
            } else {
                if (results.length > 0) {
                    resolve(results[0]); // Retorna el primer usuario encontrado
                } else {
                    resolve(null); // Retorna null si no se encuentra ningún usuario
                }
            }
        });
    });
}


// Función para actualizar el metadata del usuario en Auth0
async function updateAuth0UserMetadata(token, userId, crmId, firstName, lastName, birthDate, axxNrodocumento, suscActivas) {
    try {
        await axios.patch(`https://${auth0Domain}/api/v2/users/${userId}`, {
            user_metadata: {
                crm_id: crmId,
                first_name: firstName,
                last_name: lastName,
                birthday: birthDate,
                taxvat: axxNrodocumento,
                active_subs: suscActivas
            }
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
    } catch (error) {
        console.error(`Error updating user metadata for Auth0 user ${userId}:`, error);
    }
}
// Función para actualizar el metadata del usuario en Auth0 solo genero
async function updateAuth0UserMetadataGender(token, userId, gender) {
    try {
        await axios.patch(`https://${auth0Domain}/api/v2/users/${userId}`, {
            user_metadata: {
                gender: gender,
            }
        }, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
    } catch (error) {
        console.error(`Error updating user metadata for Auth0 user in Gender ${userId}:`, error);
    }
}

// Ruta para crear la tabla `user` en MySQL
app.get('/users/create-table-users', (req, res) => {
    const query = `
        CREATE TABLE IF NOT EXISTS user (
            id INT AUTO_INCREMENT PRIMARY KEY,
            contact_id VARCHAR(255),
            email VARCHAR(255),
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            gender_code VARCHAR(10),
            axx_genero INT,
            birth_date VARCHAR(255),
            axx_tipodocumento VARCHAR(50),
            axx_nrodocumento VARCHAR(50),
            q_susc_activas INT
        )
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error creating table:', err);
            return res.status(500).send('Error creating table.');
        }
        console.log('Table `user` created or already exists.');
        res.send('Table `user` created or already exists.');
    });
});
// Ruta para crear la tabla `user_filtered` en MySQL
app.get('/users/create-table-users-filtered', (req, res) => {
    const query = `
        CREATE TABLE IF NOT EXISTS user_filtered (
            id INT AUTO_INCREMENT PRIMARY KEY,
            contact_id VARCHAR(255),
            email VARCHAR(255),
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            gender_code VARCHAR(10),
            axx_genero INT,
            birth_date VARCHAR(255),
            axx_tipodocumento VARCHAR(50),
            axx_nrodocumento VARCHAR(50),
            q_susc_activas INT
        )
    `;

    db.query(query, (err, result) => {
        if (err) {
            console.error('Error creating table:', err);
            return res.status(500).send('Error creating table.');
        }
        console.log('Table `user_filtered` created or already exists.');
        res.send('Table `user_filtered` created or already exists.');
    });
});

//Ruta para crear la tabla de usuarios Auth0 en MySQL
app.get('/users/create-table-auth0-users', (req, res) => {
    const query = `
        CREATE TABLE IF NOT EXISTS auth0_user (
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            gender VARCHAR(255),
            birthday VARCHAR(255),
            taxvat VARCHAR(255),
            taxvat_type VARCHAR(255),
            crm_id VARCHAR(255),
            Id VARCHAR(255) PRIMARY KEY,
            Given_Name VARCHAR(255),
            Family_Name VARCHAR(255),
            Nickname VARCHAR(255),
            Name VARCHAR(255),
            Email VARCHAR(255),
            Email_Verified BOOLEAN,
            Created_At DATETIME,
            Updated_At DATETIME
        )
    `;
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error creating table:', err);
            return res.status(500).send('Error creating table.');
        }
        console.log('Table `auth0_user` created or already exists.');
        res.send('Table `auth0_user` created or already exists.');
    }
    );
});

// Ruta para subir el archivo CSV a la tabla auth0_user
app.post('/users/upload-file-auth0', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const results = [];

    fs.createReadStream(filePath)
        .pipe(csv({ separator: ',' }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            for (const row of results) {
                // Remover comillas simples de los valores
                Object.keys(row).forEach(key => {
                    row[key] = row[key].replace(/^'+|'+$/g, '');
                });

                const {
                    first_name,
                    last_name,
                    gender,
                    birthday,
                    taxvat,
                    taxvat_type,
                    crm_id,
                    Id,
                    'Given Name': Given_Name,
                    'Family Name': Family_Name,
                    Nickname,
                    Name,
                    Email,
                    'Email Verified': Email_Verified,
                    'Created At': Created_At,
                    'Updated At': Updated_At
                } = row;

                // Validar que los campos necesarios no sean nulos
                if (!Id || !Email) {
                    console.error('Missing required data: Id or Email is null');
                    continue; // Saltar esta fila si falta datos necesarios
                }
                

                const query = `INSERT INTO auth0_user (
                    first_name, last_name, gender, birthday, taxvat, taxvat_type, crm_id, Id, Given_Name, Family_Name, Nickname, Name, Email, Email_Verified, Created_At, Updated_At
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

                db.query(query, [
                    first_name || null,
                    last_name || null,
                    gender || null,
                    birthday || null,
                    taxvat || null,
                    taxvat_type || null,
                    crm_id || null,
                    Id,
                    Given_Name || null,
                    Family_Name || null,
                    Nickname || null,
                    Name || null,
                    Email,
                    Email_Verified === 'true', // Convertir a booleano
                    Created_At ? new Date(Created_At) : null,
                    Updated_At ? new Date(Updated_At) : null
                ], (err, results) => {
                    if (err) {
                        console.error('Error inserting data:', err);
                    } else {
                        console.log('Data inserted successfully for Id:', Id);
                    }
                });
            }

            fs.unlinkSync(filePath); // Elimina el archivo después de procesarlo
            res.send('Archivo CSV subido y datos insertados en la base de datos "auth0_user".');
        });
});



// Ruta para subir el archivo CSV
app.post('/users/upload-file', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const results = [];

    fs.createReadStream(filePath)
        .pipe(csv({ separator: ';' }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            for (const row of results) {
                const {
                    ContactId,
                    EMailAddress1,
                    FirstName,
                    LastName,
                    GenderCode,
                    axx_genero,
                    BirthDate,
                    axx_tipodocumento,
                    axx_nrodocumento,
                    'Q susc activas': q_susc_activas
                } = row;

                const query = 'INSERT INTO user (contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

                db.query(query, [
                    ContactId || null,
                    EMailAddress1 || null,
                    FirstName || null,
                    LastName || null,
                    GenderCode || null,
                    axx_genero || null,
                    BirthDate || null,
                    axx_tipodocumento || null,
                    axx_nrodocumento || null,
                    q_susc_activas || null
                ], (err, results) => {
                    if (err) {
                        console.error('Error inserting data:', err);
                    } else {
                        console.log('Data inserted successfully for ContactId:', ContactId);
                    }
                });
            }

            fs.unlinkSync(filePath); // Elimina el archivo después de procesarlo
            res.send('Archivo CSV subido y datos insertados en la base de datos "user".');
        });
});

// Ruta para leer datos de MySQL
app.get('/users', (req, res) => {
    const query = 'SELECT * FROM user';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error reading data from MySQL:', err);
            return res.status(500).send('Error reading data from MySQL.');
        }
        res.json(results); // Retorna los datos de usuarios
    });
});

// Ruta para buscar usuario en Auth0 por email
app.get('/users/auth0-search', async (req, res) => {
    const email = req.query.email;
    if (!email) {
        return res.status(400).send('Email is required.');
    }

    try {
        // Obtener token de acceso de Auth0
        const token = await getAuth0Token();

        // Buscar usuario en Auth0 por email
        const auth0User = await getAuth0UserByEmail(token, email);

        if (auth0User) {
            res.json(auth0User); // Retorna el usuario de Auth0
        } else {
            res.status(404).send('User not found in Auth0.');
        }
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Error processing request.');
    }
});

//Ruta para buscar usuario en MySQL por email o dni
app.get('/users/search', (req, res) => {
    const email = req.query.email;
    const dni = req.query.dni;

    if (!email && !dni) {
        return res.status(400).send('Email or DNI is required.');
    }

    let query = 'SELECT * FROM user WHERE 1=1';
    const values = [];

    if (email) {
        query += ' AND email = ?';
        values.push(email);
    }

    if (dni) {
        query += ' AND axx_nrodocumento = ?';
        values.push(dni);
    }

    db.query(query, values, (err, results) => {
        if (err) {
            console.error('Error reading data from MySQL:', err);
            return res.status(500).send('Error reading data from MySQL.');
        }

        if (results.length > 0) {
            res.json(results); // Retorna los datos de usuarios
        } else {
            res.status(404).send('User not found in MySQL.');
        }
    });
});

// Ruta para filtrar la tabla user y encontrar coincidencias en la tabla auth0_user
app.get('/users/filter-and-find', async (req, res) => {
    try {
        // Obtener todos los registros de la tabla user con email único
        const users = await getAllUsersByUniqueEmail();

        // Array para almacenar los resultados filtrados
        const filteredResults = [];

        // Recorrer los registros de user
        for (const user of users) {
            console.log('User:', user);
            const { email } = user;
            // Buscar coincidencias en la tabla auth0_user
            const auth0User = await findMatchingAuth0User( email);
            if (auth0User) {
                filteredResults.push(user);
            }
        }

        res.json(filteredResults); // Retorna los resultados filtrados
        //inserto en tabla user_filtered
        for (const user of filteredResults) {
            const { contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas } = user;
            const query = 'INSERT INTO user_filtered (contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            db.query(query, [
                contact_id || null, 
                email || null,
                first_name || null,
                last_name || null,
                gender_code || null,
                axx_genero || null,
                birth_date || null,
                axx_tipodocumento || null,
                axx_nrodocumento || null,
                q_susc_activas || null
            ], (err, results) => {
                if (err) {
                    console.error('Error inserting data:', err);
                } else {
                    console.log('Data inserted successfully for email:', email);
                }
            });
        }
    } catch (error) {
        console.error('Error filtering and finding data:', error);
        res.status(500).send('Error filtering and finding data.');
    }
});


// Ruta para leer datos de MySQL y buscar en Auth0 para actualizar metadata
app.get('/users/update-metadata', async (req, res) => {
    try {
        // Lógica para leer datos de MySQL
        const query = 'SELECT * FROM user_filtered';
        db.query(query, async (err, results) => {
            if (err) {
                console.error('Error reading data from MySQL:', err);
                return res.status(500).send('Error reading data from MySQL.');
            }

            // Obtener token de acceso de Auth0
            const token = await getAuth0Token();

            // Buscar usuarios en Auth0 por email
            const usersPromises = results.map(async (row) => {
                const email = row.email;
                // const gender = getGender(row.axx_genero);
                const crmId = row.contact_id;
                const firstName = row.first_name;
                const lastName = row.last_name;
                const birthDate = row.birth_date;
                const axxNrodocumento = row.axx_nrodocumento;
                const suscActivas = row.q_susc_activas;
                const auth0User = await getAuth0UserByEmail(token, email);

                if (auth0User) {
                    // Agregar los datos al usuario de Auth0
                    await updateAuth0UserMetadata(token, auth0User.user_id, crmId, firstName, lastName, birthDate, axxNrodocumento, suscActivas);
                    console.log(`User metadata updated for Auth0 user: ${auth0User.user_id}`);
                }

                return { email, auth0User };
            });
            // Esperar todas las promesas de búsqueda y actualización de usuarios en Auth0
            const users = await Promise.all(usersPromises);

            res.json(users); // Retorna los datos de usuarios y sus correspondientes usuarios en Auth0
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Error processing request.');
    }
});

// Ruta para leer datos de MySQL y buscar en Auth0_user para actualizar metadata de genero en Auth0
app.get('/users/update-metadata-gender-auth0', async (req, res) => {
    try {
        // Lógica para leer datos de MySQL
        const query = 'SELECT * FROM auth0_user';
        db.query(query, async (err, results) => {
            if (err) {
                console.error('Error reading data from MySQL:', err);
                return res.status(500).send('Error reading data from MySQL.');
            }

            // Obtener token de acceso de Auth0
            const token = await getAuth0Token();

            // Buscar usuarios en Auth0 por email
            const usersPromises = results.map(async (row) => {
                const email = row.Email;
                const gender = getGender(row.gender);

                const auth0User = await getAuth0UserByEmail(token, email);

                if (auth0User) {
                    // Agregar los datos al usuario de Auth0
                    await updateAuth0UserMetadataGender(token, auth0User.user_id, gender);
                    console.log(`User metadata updated for Auth0 user in Gender: ${auth0User.user_id}`);
                }

                return { email, auth0User };
            });
            // Esperar todas las promesas de búsqueda y actualización de usuarios en Auth0
            const users = await Promise.all(usersPromises);

            res.json(users); // Retorna los datos de usuarios y sus correspondientes usuarios en Auth0
        });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).send('Error processing request.');
    }
});

// Ruta para limpiar la tabla user de MySQL
app.post('/users/clear-table', (req, res) => {
    const query = 'TRUNCATE TABLE user';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error truncating table:', err);
            return res.status(500).send('Error truncating table.');
        }
        console.log('Tabla user limpiada.');
        res.send('Tabla user limpiada.');
    });
});
// Ruta para limpiar la tabla user filtered de MySQL
app.post('/users/clear-table-user-filtered', (req, res) => {
    const query = 'TRUNCATE TABLE user_filtered';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error truncating table:', err);
            return res.status(500).send('Error truncating table.');
        }
        console.log('Tabla user_filtered limpiada.');
        res.send('Tabla user_filtered limpiada.');
    });
});

// Ruta para limpiar la tabla auth0_user de MySQL
app.post('/users/clear-table-auth0', (req, res) => {
    const query = 'TRUNCATE TABLE auth0_user';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error truncating table:', err);
            return res.status(500).send('Error truncating table.');
        }
        console.log('Tabla auth0_user limpiada.');
        res.send('Tabla auth0_user limpiada.');
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
