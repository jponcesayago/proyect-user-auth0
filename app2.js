const express = require('express');
const multer = require('multer');
const mysql = require('mysql');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

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
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'users_auth0'
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
const auth0Domain = 'prod-bwbqs8n8.us.auth0.com'; // Reemplazar con tu dominio Auth0
const auth0ClientId = '2tGJL6SRN8gu8oFwAIZd5brmFQ4Tn2IV'; // Reemplazar con tu Client ID de Auth0
const auth0ClientSecret = 'B0ljIrMbT6xccJEtMLBOoMgKYytOEffYkgOpFgaB-x9Z4sdUnkPDV_hTtwC6-FTn'; // Reemplazar con tu Client Secret de Auth0
const auth0Audience = 'https://prod-bwbqs8n8.us.auth0.com/api/v2/'; // Reemplazar con el Identificador de tu API

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

// Ruta para subir el archivo CSV
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const results = [];
    const token = await getAuth0Token();

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

                const auth0User = await getAuth0UserByEmail(token, EMailAddress1);

                if (auth0User) {
                    console.log(`Auth0 User: ${auth0User.user_id}, Email: ${auth0User.email}`);
                    // Aquí podrías actualizar la base de datos MySQL con información de Auth0 si lo deseas.
                } else {
                    console.log(`No Auth0 user found for email: ${EMailAddress1}`);
                }

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

// Ruta para limpiar la tabla user
app.post('/clear-table', (req, res) => {
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
