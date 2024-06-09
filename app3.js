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

// Función para actualizar el metadata del usuario en Auth0
async function updateAuth0UserMetadata(token, userId, gender, crmId, firstName, lastName, birthDate, axxNrodocumento, suscActivas) {
    try {
        await axios.patch(`https://${auth0Domain}/api/v2/users/${userId}`, {
            user_metadata: {
                gender: gender,
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

                db.query(query, [ContactId, EMailAddress1, FirstName, LastName, GenderCode, axx_genero, BirthDate, axx_tipodocumento, axx_nrodocumento, q_susc_activas], (err, results) => {
                    if (err) {
                        console.error('Error inserting data:', err);
                    }
                });
            }

            fs.unlinkSync(filePath); // Elimina el archivo después de procesarlo
            console.log('Archivo CSV subido y datos insertados en la base de datos.');
            res.send('Archivo CSV subido y datos insertados en la base de datos.');
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

// Ruta para leer datos de MySQL y buscar en Auth0 para actualizar metadata
app.get('/users/update-metadata', async (req, res) => {
    try {
        // Lógica para leer datos de MySQL
        const query = 'SELECT email, axx_genero FROM user';
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
                const gender = getGender(row.axx_genero);
                const crmId = row.contact_id;
                const firstName = row.first_name;
                const lastName = row.last_name;
                const birthDate = row.birth_date;
                const axxNrodocumento = row.axx_nrodocumento;
                const suscActivas = row.q_susc_activas;
                const auth0User = await getAuth0UserByEmail(token, email);

                if (auth0User) {
                    // Agregar los datos al usuario de Auth0
                    await updateAuth0UserMetadata(token, auth0User.user_id, gender, crmId, firstName, lastName, birthDate, axxNrodocumento, suscActivas);
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

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/`);
});
