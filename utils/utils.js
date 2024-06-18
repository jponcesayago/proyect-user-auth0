const axios = require('axios');
const dotenv = require('dotenv');

// Cargar variables de entorno desde el archivo .env
dotenv.config();

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

// Función para obtener el género en el formato esperado
function getGender(genderCode) {
    switch (genderCode) {
        case 1:
        case '1':
        case 'masc':
        case 'masculino':
        case 'Masculino':
        case 'MASCULINO':
            return 'Masculino';
        case 2:
        case '2':
        case 'fem':
        case 'femenino':
        case 'Femenino':
        case 'FEMENINO':
            return 'Femenino';
        default:
            return 'Masculino';
    }
}

//exportar la función
module.exports = {
    getAuth0Token,
    getAuth0UserByEmail,
    getAllUsers,
    getAllUsersByUniqueEmail,
    findMatchingAuth0User,
    updateAuth0UserMetadata,
    updateAuth0UserMetadataGender,
    getGender
};

