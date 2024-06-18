const dotenv = require('dotenv');
const connectDB = require('../db/MySql/config');
const fs = require('fs');
const csv = require('csv-parser');
const { getAuth0Token, getAuth0UserByEmail, getAllUsersByUniqueEmail, findMatchingAuth0User, updateAuth0UserMetadata, updateAuth0UserMetadataGender } = require('../utils/utils');

// Cargar variables de entorno desde el archivo .env
dotenv.config();

class User {
    // Obtener todos los usuarios de MySQL
    static async getAllUsers() {
        try {
            // Obtener la conexión a la base de datos
            const db = await connectDB();
            const [results] = await db.query('SELECT * FROM user');
            return results;
        } catch (error) {
            console.error('Error fetching data from user table:', error);
            throw error;
        }
    }

    // Ruta para crear la tabla `user` en MySQL
    static async createTableUser() {
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

        try {
            // Obtener la conexión a la base de datos
            const db = await connectDB();
            const [results] = await db.query(query);
            return 'Table `user` created or already exists.'
        } catch (error) {
            console.error('Error creating user table:', error);
            throw error;
        }
    }

    // Ruta para crear la tabla `user_filtered` en MySQL
    static async createTableUserFiltered() {
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

        try {
            // Obtener la conexión a la base de datos
            const db = await connectDB();
            const [results] = await db.query(query);
            return 'Table `user_filtered` created or already exists.'
        } catch (error) {
            console.error('Error creating user_filtered table:', error);
            throw error;
        }
    }
    // Ruta para crear la tabla `auth0_user` en MySQL
    static async createTableUserAuth0() {
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

        try {
            // Obtener la conexión a la base de datos
            const db = await connectDB();
            const [results] = await db.query(query);
            return 'Table `auth0_user` created or already exists.'
        } catch (error) {
            console.error('Error creating auth0_user table:', error);
            throw error;
        }
    }

    // Ruta para subir el archivo CSV a la tabla auth0_user
    static async uploadCSVUserAuth0(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject('No file uploaded.');
                return;
            }

            const filePath = file.path;
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

                        try {
                            // Obtener la conexión a la base de datos
                            const db = await connectDB();

                            await db.query(query, [
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
                            ]);
                            console.log('Data inserted successfully for Id:', Id);
                        } catch (error) {
                            console.error('Error inserting data:', error);
                        }
                    }

                    fs.unlinkSync(filePath); // Elimina el archivo después de procesarlo
                    resolve('Archivo CSV subido y datos insertados en la base de datos "auth0_user".');
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // Ruta para subir el archivo CSV a la tabla user
    static async uploadCSVUser(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject('No file uploaded.');
                return;
            }

            const filePath = file.path;
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

                        try {
                            // Obtener la conexión a la base de datos
                            const db = await connectDB();

                            await db.query(query, [
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
                            ]);
                            console.log('Data inserted successfully for Id:', ContactId);
                        } catch (error) {
                            console.error('Error inserting data:', error);
                        }
                    }

                    fs.unlinkSync(filePath); // Elimina el archivo después de procesarlo
                    resolve('Archivo CSV subido y datos insertados en la base de datos "user".');
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    // Ruta para buscar usuario en Auth0 por email
    static async findMatchingAuth0User(email) {
        try {
            // Obtener token de acceso de Auth0
            const token = await getAuth0Token();

            // Buscar usuario en Auth0 por email
            const auth0User = await getAuth0UserByEmail(token, email);

            if (auth0User) {
                return auth0User;
            } else {
                return 'No matching user found in Auth0.';
            }
        } catch (error) {
            console.error('Error processing request:', error);
            throw error;
        }
    }

    //Ruta para buscar usuario en MySQL por email o dni
    static async findMatchingUser(email, dni) {
        try {

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
            // Obtener la conexión a la base de datos
            const db = await connectDB();
            await db.query(query, values, (err, results) => {
                if (err) {
                    console.error('Error reading data from MySQL:', err);
                    return res.status(500).send('Error reading data from MySQL.');
                }

                if (results.length > 0) {
                    return res.status(200).send(results);
                } else {
                    return res.status(404).send('No matching user found in MySQL.');
                }
            });
        } catch (error) {
            console.error('Error fetching data from user table:', error);
            throw error;
        }
    }

    // Ruta para filtrar la tabla user y encontrar coincidencias en la tabla auth0_user
    static async filterAndFind() {
        try {
            // Obtener todos los registros de la tabla user con email único
            const users = await getAllUsersByUniqueEmail();

            // Array para almacenar los resultados filtrados
            const filteredResults = [];

            // Recorrer los registros de user
            for (const user of users) {
                const { email } = user;
                // Buscar coincidencias en la tabla auth0_user
                const auth0User = await findMatchingAuth0User(email);
                if (auth0User) {
                    filteredResults.push(user);
                }
            }

            //inserto en tabla user_filtered
            for (const user of filteredResults) {
                const { contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas } = user;
                const query = 'INSERT INTO user_filtered (contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                // Obtener la conexión a la base de datos
                const db = await connectDB();
                await db.query(query, [
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
                        return 'Error inserting data:', err;
                    } else {
                        console.log('Data inserted successfully for email:', email);
                        return 'Data inserted successfully for email:', email;
                    }
                });
            }
        } catch (error) {
            console.error('Error filtering and finding data:', error);
            return 'Error filtering and finding data:', error;
        }
    }

    // Ruta para leer datos de MySQL y buscar en Auth0 para actualizar metadata
    static async updateMetadata() {
        try {
            // Lógica para leer datos de MySQL
            const query = 'SELECT * FROM user_filtered';
            const db = await connectDB();
            await db.query(query, async (err, results) => {
                if (err) {
                    console.error('Error reading data from MySQL:', err);
                    return res.status(500).send('Error reading data from MySQL.');
                }

                // Obtener token de acceso de Auth0
                const token = await getAuth0Token();

                // Buscar usuarios en Auth0 por email
                const usersPromises = results.map(async (row) => {
                    const email = row.email;
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

                return users;
            });
        } catch (error) {
            console.error('Error processing request:', error);
            throw error;
        }
    }

    // Ruta para leer datos de MySQL y buscar en Auth0_user para actualizar metadata de genero en Auth0
    static async updateMetadataGenderAuth0() {
        try {
            // Lógica para leer datos de MySQL
            const query = 'SELECT * FROM auth0_user';
            const db = await connectDB();
            await db.query(query, async (err, results) => {
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
                const users = await Promise.all(usersPromises); G

                return users; // Retorna los datos de usuarios y sus correspondientes usuarios en Auth0
            });
        } catch (error) {
            console.error('Error processing request:', error);
            throw error;
        }
    }

    // Ruta para limpiar la tabla user de MySQL
    static async clearTableUser() {
        const query = 'TRUNCATE TABLE user_test';
        try {
            // Obtener la conexión a la base de datos
            const db = await connectDB();
            await db.query(query);
            return 'Tabla user limpiada.';
        } catch (error) {
            console.error('Error truncating table:', error);
            throw error;
        }
    }

    // Ruta para limpiar la tabla user filtered de MySQL
    static async clearTableUserFiltered() {
        const query = 'TRUNCATE TABLE user_filtered';
        try {
            // Obtener la conexión a la base de datos
            const db = await connectDB();
            await db.query(query);
            return 'Tabla user_filtered limpiada.';
        } catch (error) {
            console.error('Error truncating table:', error);
            throw error;
        }
    }

    // Ruta para limpiar la tabla auth0_user de MySQL
    static async clearTableAuth0() {
        const query = 'TRUNCATE TABLE auth0_user';
        try {
            // Obtener la conexión a la base de datos
            const db = await connectDB();
            await db.query(query);
            return 'Tabla auth0_user limpiada.';
        } catch (error) {
            console.error('Error truncating table:', error);
            throw error;
        }
    }

}



module.exports = User;
