import express from "express";
import multer from "multer";
import mysql from "mysql";
import csv from "csv-parser";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import pLimit from "p-limit";
import {
  getAllUsersByUniqueEmailAndStatusActive,
  getAuth0UserByDNI,
  getAuth0Token,
  getAuth0UserByEmail,
  getGender,
  findMatchingAuth0User,
  findMatchingAuth0UserOnlyByDni,
  updateAuth0UserMetadataGender,
  deleteUserInAuth0,
  convertBirthday,
  shouldConvertBirthday,
  updateAuth0UserMetadataContactId,
} from "./utils/auth0-mitgration.mjs";

import { getVtexUserData, updateVtexUserData } from "./utils/vtex-api-service.mjs";

// Cargar variables de entorno desde el archivo .env
dotenv.config();
const app = express();
const port = process.env.PORT ?? 3000;

// Configuración de almacenamiento para Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Crear carpeta de uploads si no existe
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Configuración de la base de datos MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Conectar a la base de datos MySQL
db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the MySQL database.");
});

/* ################################### ROUTES ####################################### */
// Ruta para crear la tabla `user` en MySQL
app.get("/users/create-table-users", (req, res) => {
  const query = `
        CREATE TABLE IF NOT EXISTS user (
            id INT AUTO_INCREMENT PRIMARY KEY,
            created_on VARCHAR(255),
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
      console.error("Error creating table:", err);
      return res.status(500).send("Error creating table.");
    }
    console.log("Table `user` created or already exists.");
    res.send("Table `user` created or already exists.");
  });
});

// Ruta para crear la tabla `user_filtered` en MySQL
app.get("/users/create-table-users-filtered", (req, res) => {
  const query = `
        CREATE TABLE IF NOT EXISTS user_filtered (
            id INT AUTO_INCREMENT PRIMARY KEY,
            created_on VARCHAR(255),
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
      console.error("Error creating table:", err);
      return res.status(500).send("Error creating table.");
    }
    console.log("Table `user_filtered` created or already exists.");
    res.send("Table `user_filtered` created or already exists.");
  });
});

//Ruta para crear la tabla de usuarios Auth0 en MySQL
app.get("/users/create-table-auth0-users", (req, res) => {
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
            Updated_At DATETIME,
            last_login DATETIME
        )
    `;
  db.query(query, (err, result) => {
    if (err) {
      console.error("Error creating table:", err);
      return res.status(500).send("Error creating table.");
    }
    console.log("Table `auth0_user` created or already exists.");
    res.send("Table `auth0_user` created or already exists.");
  });
});

// Ruta para subir el archivo de Logging txt del proceso de mergeo de contactos a la tabla merged_users en MySQL
app.post(
  "/users/upload-file-merged-users",
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const filePath = req.file.path;
    const results = [];
    console.log("File path:", filePath);
    try {
      // Leer el contenido del archivo
      const data = fs.readFileSync(filePath, "utf8");
      // Expresión regular para encontrar los DNI en el formato "dni=11788802"
      const regex_dni = /dni=(\d+)/;

      // Expresión regular para encontrar las líneas que contienen el patrón
      const regex_contact_id =
        /El contacto principal a mergear será ([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/;

      // Dividir el archivo en líneas
      const lines = data.split("\n");
      // Variables temporales para almacenar el DNI y el contact_id
      let currentDni = null;
      let currentContactId = null;

      // Recorrer cada línea del archivo
      for (const line of lines) {
        // Buscar el DNI en la línea actual
        const dniMatch = line.match(regex_dni);
        if (dniMatch) {
          currentDni = dniMatch[1]; // Almacenar el DNI encontrado
        }
        // console.log("DNI:", currentDni);
        // Buscar el contact_id en la línea actual
        const contactIdMatch = line.match(regex_contact_id);
        if (contactIdMatch) {
          currentContactId = contactIdMatch[1]; // Almacenar el contact_id encontrado
        }
        // Si tenemos tanto el DNI como el contact_id, los agrupamos
        if (currentDni && currentContactId) {
          results.push({ dni: currentDni, contact_id: currentContactId }); // Almacenar los ContactId y dni encontrados
          currentDni = null; // Reiniciar el DNI
          currentContactId = null; // Reiniciar el contact_id
        }
      }

      console.log("ContactIds:", results);

      for (const row of results) {
        const { dni, contact_id } = row;
        console.log("Row:", row);
        // Insertar los datos en la tabla merged_users
        const query = `INSERT INTO merged_users (ContactId, axx_nrodocumento ) VALUES (?, ?)`;

        if (!dni || !contact_id) {
          console.error(
            "Missing required data: ContactId or axx_nrodocumento is null"
          );
          continue; // Saltar esta fila si falta datos necesarios
        }
        db.query(query, [contact_id || null, dni || null], (err, results) => {
          if (err) {
            console.error("Error inserting data:", err);
          } else {
            console.log(
              "Data inserted successfully for contact_id:",
              contact_id
            );
          }
        });
      }
      // Enviar la respuesta con los resultados
      res.status(200).json({ contactIds: results });
    } catch (err) {
      console.error("Error al procesar el archivo:", err);
      res.status(500).send("Error al procesar el archivo.");
    } finally {
      // Eliminar el archivo subido después de procesarlo (opcional)
      fs.unlinkSync(filePath);
    }
  }
);

// Ruta para subir el archivo CSV a la tabla auth0_user en MySQL
app.post(
  "/users/upload-file-auth0",
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const filePath = req.file.path;
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv({ separator: "," }))
      .on("data", (data) => results.push(data))
      .on("end", async () => {
        for (const row of results) {
          // Remover comillas simples de los valores
          Object.keys(row).forEach((key) => {
            row[key] = row[key].replace(/^'+|'+$/g, "");
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
            "Given Name": Given_Name,
            "Family Name": Family_Name,
            Nickname,
            Name,
            Email,
            "Email Verified": Email_Verified,
            "Created At": Created_At,
            "Updated At": Updated_At,
            "Last Login": last_login,
          } = row;

          // Validar que los campos necesarios no sean nulos
          if (!Id || !Email) {
            console.error("Missing required data: Id or Email is null");
            continue; // Saltar esta fila si falta datos necesarios
          }

          const query = `INSERT INTO auth0_user (
                    first_name, last_name, gender, birthday, taxvat, taxvat_type, crm_id, Id, Given_Name, Family_Name, Nickname, Name, Email, Email_Verified, Created_At, Updated_At, last_login
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

          db.query(
            query,
            [
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
              Email_Verified === "true", // Convertir a booleano
              Created_At ? new Date(Created_At) : null,
              Updated_At ? new Date(Updated_At) : null,
              last_login ? new Date(last_login) : null,
            ],
            (err, results) => {
              if (err) {
                console.error("Error inserting data:", err);
              } else {
                console.log("Data inserted successfully for Id:", Id);
              }
            }
          );
        }

        fs.unlinkSync(filePath); // Elimina el archivo después de procesarlo
        res.send(
          'Archivo CSV subido y datos insertados en la base de datos "auth0_user".'
        );
      });
  }
);

// Ruta para subir el archivo CSV a la tabla user de MySQL
app.post("/users/upload-file", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded.");
  }

  const filePath = req.file.path;
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv({ separator: ";" }))
    .on("data", (data) => results.push(data))
    .on("end", async () => {
      for (const row of results) {
        const {
          CreatedOn,
          ContactId,
          EMailAddress1,
          FirstName,
          LastName,
          GenderCode,
          axx_genero,
          BirthDate,
          axx_tipodocumento,
          axx_nrodocumento,
          "Q susc activas": q_susc_activas,
        } = row;

        const query =
          "INSERT INTO user (created_on, contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        db.query(
          query,
          [
            CreatedOn || null,
            ContactId || null,
            EMailAddress1 || null,
            FirstName || null,
            LastName || null,
            GenderCode || null,
            axx_genero || null,
            BirthDate || null,
            axx_tipodocumento || null,
            axx_nrodocumento || null,
            q_susc_activas || null,
          ],
          (err, results) => {
            if (err) {
              console.error("Error inserting data:", err);
            } else {
              console.log(
                "Data inserted successfully for ContactId:",
                ContactId,
                CreatedOn
              );
            }
          }
        );
      }

      fs.unlinkSync(filePath); // Elimina el archivo después de procesarlo
      res.send(
        'Archivo CSV subido y datos insertados en la base de datos "user".'
      );
    });
});

// Ruta para leer datos de MySQL
app.get("/users", (req, res) => {
  const query = "SELECT * FROM user";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error reading data from MySQL:", err);
      return res.status(500).send("Error reading data from MySQL.");
    }
    res.json(results); // Retorna los datos de usuarios
  });
});

// Ruta para buscar usuario en Auth0 por email
app.get("/users/auth0-search", async (req, res) => {
  const email = req.query.email;
  if (!email) {
    return res.status(400).send("Email is required.");
  }

  try {
    // Obtener token de acceso de Auth0
    const token = await getAuth0Token();

    // Buscar usuario en Auth0 por email
    const auth0User = await getAuth0UserByEmail(token, email);

    if (auth0User) {
      res.json(auth0User); // Retorna el usuario de Auth0
    } else {
      res.status(404).send("User not found in Auth0.");
    }
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }
});

//Ruta para buscar usuario en MySQL por email o dni
app.get("/users/search", (req, res) => {
  const email = req.query.email;
  const dni = req.query.dni;

  if (!email && !dni) {
    return res.status(400).send("Email or DNI is required.");
  }

  let query = "SELECT * FROM user WHERE 1=1";
  const values = [];

  if (email) {
    query += " AND email = ?";
    values.push(email);
  }

  if (dni) {
    query += " AND axx_nrodocumento = ?";
    values.push(dni);
  }

  db.query(query, values, (err, results) => {
    if (err) {
      console.error("Error reading data from MySQL:", err);
      return res.status(500).send("Error reading data from MySQL.");
    }

    if (results.length > 0) {
      res.json(results); // Retorna los datos de usuarios
    } else {
      res.status(404).send("User not found in MySQL.");
    }
  });
});

// Ruta para filtrar y encontrar usuarios en MySQL y Auth0 ya sea por email o DNI y volcarlos en la tabla user_filtered o user_filtered_bydni
app.get("/users/filter-and-find", async (req, res) => {
  try {
    const users = await getAllUsersByUniqueEmailAndStatusActive();
    const filteredResults = [];

    for (const user of users) {
      console.log("User:", user);
      const { email, axx_nrodocumento } = user;
      const auth0User = await findMatchingAuth0User(email?.toLowerCase()); // Buscar por email y guardar en tabla user_filtered
      // const auth0User = await findMatchingAuth0UserByDni(email?.toLowerCase(), axx_nrodocumento); // Buscar por DNI y guardar en tabla user_filtered_bydni
      if (auth0User) {
        filteredResults.push(user);
      }
    }

    // Guardar en tabla user_filtered y manejar logs
    const logSuccess = [];
    const logError = [];

    for (const user of filteredResults) {
      const {
        created_on,
        contact_id,
        email,
        first_name,
        last_name,
        gender_code,
        axx_genero,
        birth_date,
        axx_tipodocumento,
        axx_nrodocumento,
        q_susc_activas,
      } = user;
      const query =
        "INSERT INTO user_filtered (created_on, contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      // const query = 'INSERT INTO user_filtered_bydni (created_on, contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      try {
        await new Promise((resolve, reject) => {
          db.query(
            query,
            [
              created_on || null,
              contact_id || null,
              email || null,
              first_name || null,
              last_name || null,
              gender_code || null,
              axx_genero || null,
              birth_date || null,
              axx_tipodocumento || null,
              axx_nrodocumento || null,
              q_susc_activas || 0,
            ],
            (err, results) => {
              if (err) {
                logError.push(
                  `Error inserting data: ${email} with ContactId: ${contact_id} and DNI: ${axx_nrodocumento}`
                );
                return reject(err);
              } else {
                logSuccess.push(
                  `User filtered: ${email} with ContactId: ${contact_id} and DNI: ${axx_nrodocumento}`
                );
                return resolve(results);
              }
            }
          );
        });
      } catch (err) {
        console.error("Error inserting data:", err);
      }
    }

    // Escribir logs en archivos al final
    if (logError.length) {
      // fs.appendFile('logsErrorUserFilteredByDNI.txt', logError.join('\n') + '\n', (err) => {
      fs.appendFile(
        "logsErrorUserFiltered.txt",
        logError.join("\n") + "\n",
        (err) => {
          if (err) console.error("Error writing logs:", err);
        }
      );
    }

    if (logSuccess.length) {
      // fs.appendFile('logsSuccesUserFilteredByDNI.txt', logSuccess.join('\n') + '\n', (err) => {
      fs.appendFile(
        "logsSuccesUserFiltered.txt",
        logSuccess.join("\n") + "\n",
        (err) => {
          if (err) console.error("Error writing logs:", err);
        }
      );
    }

    // Contar éxitos y errores
    const successCount = logSuccess.length;
    const errorCount = logError.length;

    // Agregar conteo al final de los logs
    // fs.appendFile('logsSummaryUserFilteredByDNI.txt', `Total successful inserts: ${successCount}\nTotal errors: ${errorCount}\n`, (err) => {
    fs.appendFile(
      "logsSummaryUserFiltered.txt",
      `Total successful inserts: ${successCount}\nTotal errors: ${errorCount}\n`,
      (err) => {
        if (err) {
          console.error("Error writing summary logs:", err);
        }
      }
    );

    res.json(filteredResults); // Retorna los resultados filtrados
  } catch (error) {
    console.error("Error filtering and finding data:", error);
    res.status(500).send("Error filtering and finding data.");
  }
});

// Ruta para filtrar y encontrar usuarios en MySQL y Auth0 ya sea por DNI y volcarlos en la tabla user_filtered
app.get("/users/filter-and-find-dni", async (req, res) => {
  try {
    const users = await getAllUsersByUniqueEmailAndStatusActive();
    const filteredResults = [];
    console.log("users", users.length);
    let iterationCount = 0; // Inicializamos un contador

    for (const user of users) {
      iterationCount++; // Incrementamos el contador en cada iteración
      console.log(`Iteration: ${iterationCount} / ${users.length}`); // Logueo del progreso

      const { email, axx_nrodocumento } = user;

      // Llamada a la función asincrónica
      const auth0User = await findMatchingAuth0UserOnlyByDni(axx_nrodocumento);

      if (auth0User) {
        filteredResults.push(user); // Si encuentra un usuario coincidente, lo agrega a los resultados filtrados
      }
    }

    console.log("filteredResults", filteredResults?.length);

    // Guardar en tabla user_filtered y manejar logs
    const logSuccess = [];
    const logError = [];

    for (const user of filteredResults) {
      const {
        created_on,
        contact_id,
        email,
        first_name,
        last_name,
        gender_code,
        axx_genero,
        birth_date,
        axx_tipodocumento,
        axx_nrodocumento,
        q_susc_activas,
      } = user;
      const query =
        "INSERT INTO user_filtered (created_on, contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      // const query = 'INSERT INTO user_filtered_bydni (created_on, contact_id, email, first_name, last_name, gender_code, axx_genero, birth_date, axx_tipodocumento, axx_nrodocumento, q_susc_activas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

      try {
        await new Promise((resolve, reject) => {
          db.query(
            query,
            [
              created_on || null,
              contact_id || null,
              email || null,
              first_name || null,
              last_name || null,
              gender_code || null,
              axx_genero || null,
              birth_date || null,
              axx_tipodocumento || null,
              axx_nrodocumento || null,
              q_susc_activas || 0,
            ],
            (err, results) => {
              if (err) {
                logError.push(
                  `Error inserting data: ${email} with ContactId: ${contact_id} and DNI: ${axx_nrodocumento}`
                );
                return reject(err);
              } else {
                logSuccess.push(
                  `User filtered: ${email} with ContactId: ${contact_id} and DNI: ${axx_nrodocumento}`
                );
                return resolve(results);
              }
            }
          );
        });
      } catch (err) {
        console.error("Error inserting data:", err);
      }
    }

    // Escribir logs en archivos al final
    if (logError.length) {
      // fs.appendFile('logsErrorUserFilteredByDNI.txt', logError.join('\n') + '\n', (err) => {
      fs.appendFile(
        "logsErrorUserFiltered.txt",
        logError.join("\n") + "\n",
        (err) => {
          if (err) console.error("Error writing logs:", err);
        }
      );
    }

    if (logSuccess.length) {
      // fs.appendFile('logsSuccesUserFilteredByDNI.txt', logSuccess.join('\n') + '\n', (err) => {
      fs.appendFile(
        "logsSuccesUserFiltered.txt",
        logSuccess.join("\n") + "\n",
        (err) => {
          if (err) console.error("Error writing logs:", err);
        }
      );
    }

    // Contar éxitos y errores
    const successCount = logSuccess.length;
    const errorCount = logError.length;

    // Agregar conteo al final de los logs
    // fs.appendFile('logsSummaryUserFilteredByDNI.txt', `Total successful inserts: ${successCount}\nTotal errors: ${errorCount}\n`, (err) => {
    fs.appendFile(
      "logsSummaryUserFiltered.txt",
      `Total successful inserts: ${successCount}\nTotal errors: ${errorCount}\n`,
      (err) => {
        if (err) {
          console.error("Error writing summary logs:", err);
        }
      }
    );

    res.json(filteredResults); // Retorna los resultados filtrados
  } catch (error) {
    console.error("Error filtering and finding data:", error);
    res.status(500).send("Error filtering and finding data.");
  }
});

// Límite de solicitudes concurrentes
const limit = pLimit(5); // Ajusta este valor según tus necesidades y límites de Auth0
let count = 0;

// Ruta para leer datos de MySQL y buscar en Auth0 para actualizar metadata
app.get("/users/update-metadata", async (req, res) => {
  const limitParam = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;

  let count = 0;
  const logSuccess = [];
  const logError = [];

  try {
    const query = "SELECT * FROM user_filtered LIMIT ? OFFSET ?";
    db.query(query, [limitParam, offset], async (err, results) => {
      if (err) {
        console.error("Error reading data from MySQL:", err);
        return res.status(500).send("Error reading data from MySQL.");
      }

      try {
        const token = await getAuth0Token();
        let auth0User;
        const usersPromises = results.map((row) =>
          limit(async () => {
            const email = row.email;
            // const crmId = row.contact_id;
            // const firstName = row.first_name;
            // const lastName = row.last_name;
            // const birthDate = row.birth_date;
            const axxNrodocumento = row.axx_nrodocumento;
            const suscActivas = row.q_susc_activas;
            // Intentar primero buscar por email
            // let auth0User = await getAuth0UserByEmail(token, email?.toLowerCase());

            // Si no encuentra por email, buscar por DNI
            // if (!auth0User) {
            // console.log(`No user found with email: ${email}. Trying with DNI: ${axxNrodocumento}`);
            auth0User = await getAuth0UserByDNI(token, axxNrodocumento);
            // }
            console.log("Auth0 user by email updated:", auth0User);
            // console.log('Auth0 user by dni updated:', auth0User[0].user_id);

            if (Array.isArray(auth0User)) {
              for (const user of auth0User) {
                if (user) {
                  await updateAuth0UserMetadata(
                    token,
                    user.user_id,
                    // crmId,
                    // firstName,
                    // lastName,
                    // birthDate,
                    // axxNrodocumento,
                    suscActivas
                  );
                  count++;
                  logSuccess.push(
                    `User metadata updated for Auth0 user by EMAIL OR DNI: ${user.user_id} (${count})`
                  );
                  console.log(
                    `User metadata updated for Auth0 user: ${user.user_id} (${count})`
                  );
                }
              }
            } else if (auth0User) {
              // Fallback para el caso en que auth0User no sea un array (es un solo objeto)
              await updateAuth0UserMetadata(
                token,
                auth0User.user_id,
                // crmId,
                // firstName,
                // lastName,
                // birthDate,
                // axxNrodocumento,
                suscActivas
              );
              count++;
              logSuccess.push(
                `User metadata updated for Auth0 user by EMAIL OR DNI: ${auth0User.user_id} (${count})`
              );
              console.log(
                `User metadata updated for Auth0 user: ${auth0User.user_id} (${count})`
              );
            } else {
              console.error("No valid auth0User data to process.");
            }

            // if (auth0User) {
            //     await updateAuth0UserMetadata(
            //         token,
            //         auth0User.user_id,
            //         // crmId,
            //         // firstName,
            //         // lastName,
            //         // birthDate,
            //         // axxNrodocumento,
            //         suscActivas
            //     );
            //     count++;
            //     logSuccess.push(`User metadata updated for Auth0 user by EMAIL OR DNI: ${auth0User.user_id} (${count})`);
            //     console.log(`User metadata updated for Auth0 user: ${auth0User.user_id} (${count})`);
            // }

            return { email, auth0User };
          })
        );

        const users = await Promise.all(usersPromises);

        // Escribir logs de éxito al final
        if (logSuccess.length) {
          fs.appendFile(
            "logsSuccessUpdateMetadataByEMAILORDNI.txt",
            logSuccess.join("\n") + "\n",
            (err) => {
              if (err) {
                console.error("Error writing success logs:", err);
              }
            }
          );
        }

        // Contar y registrar errores
        const errorCount = logError.length;
        if (errorCount > 0) {
          fs.appendFile(
            "logsErrorUpdateMetadataBYEMAILORDNI.txt",
            logError.join("\n") + "\n",
            (err) => {
              if (err) {
                console.error("Error writing error logs:", err);
              }
            }
          );
        }

        // Agregar conteo al final de los logs
        fs.appendFile(
          "logsSummaryUpdateMetadataByEMAILORDNI.txt",
          `Total metadata updates: ${count}\nTotal errors: ${errorCount}\n`,
          (err) => {
            if (err) {
              console.error("Error writing summary logs:", err);
            }
          }
        );

        res.json(users);
      } catch (error) {
        console.error("Error updating user metadata:", error);
        res.status(500).send("Error updating user metadata.");
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }
});

// Ruta para borrar usuario en Auth0 por email leido de la tabla auth0_user
app.get("/users/delete-auth0-user", async (req, res) => {
  const limitParam = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;

  let count = 0;
  const logSuccess = [];
  const logError = [];

  try {
    const query = "SELECT * FROM auth0_user LIMIT ? OFFSET ?";
    db.query(query, [limitParam, offset], async (err, results) => {
      if (err) {
        console.error("Error reading data from MySQL:", err);
        return res.status(500).send("Error reading data from MySQL.");
      }

      try {
        const token = await getAuth0Token();

        const usersPromises = results.map((row) =>
          limit(async () => {
            const email = row.Email;
            const auth0User = await getAuth0UserByEmail(token, email);

            if (auth0User) {
              await deleteUserInAuth0(auth0User.user_id, token);
              count++;
              logSuccess.push(
                `User deleted in Auth0: ${auth0User.user_id} (${count})`
              );
              console.log(
                `User deleted in Auth0: ${auth0User.user_id} (${count})`
              );
            }

            return { email, auth0User };
          })
        );

        const users = await Promise.all(usersPromises);

        // Escribir logs de éxito al final
        if (logSuccess.length) {
          fs.appendFile(
            "logsSuccessDeleteAuth0User.txt",
            logSuccess.join("\n") + "\n",
            (err) => {
              if (err) {
                console.error("Error writing success logs:", err);
              }
            }
          );
        }

        // Contar y registrar errores
        const errorCount = logError.length;
        if (errorCount > 0) {
          fs.appendFile(
            "logsErrorDeleteAuth0User.txt",
            logError.join("\n") + "\n",
            (err) => {
              if (err) {
                console.error("Error writing error logs:", err);
              }
            }
          );
        }

        // Agregar conteo al final de los logs
        fs.appendFile(
          "logsSummaryDeleteAuth0User.txt",
          `Total users deleted: ${count}\nTotal errors: ${errorCount}\n`,
          (err) => {
            if (err) {
              console.error("Error writing summary logs:", err);
            }
          }
        );

        res.json(users);
      } catch (error) {
        console.error("Error deleting user in Auth0:", error);
        res.status(500).send("Error deleting user in Auth0.");
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }
});

// Ruta para borrar usuarios en Auth0 leyendo desde un array de emails
app.get("/users/delete-auth0-user-by-email-array", async (req, res) => {
  const emails = [
    "la_mole99@hotmail.com",
    "martingomezc+1@hotmail.com",
    "henryvarg@gmail.com",
  ];

  let count = 0;
  const logSuccess = [];
  const logError = [];

  try {
    const token = await getAuth0Token();

    const usersPromises = emails.map((email) =>
      limit(async () => {
        try {
          const auth0User = await getAuth0UserByEmail(token, email);

          if (auth0User) {
            await deleteUserInAuth0(auth0User.user_id, token);
            count++;
            logSuccess.push(
              `User deleted in Auth0: ${auth0User.user_id} (${count})`
            );
            console.log(
              `User deleted in Auth0: ${auth0User.user_id} (${count})`
            );
          }
        } catch (error) {
          logError.push(
            `Error deleting user with email ${email}: ${error.message}`
          );
          console.error(`Error deleting user with email ${email}:`, error);
        }
      })
    );

    await Promise.all(usersPromises);

    // Escribir logs de éxito
    if (logSuccess.length) {
      fs.appendFile(
        "logsSuccessDeleteAuth0User.txt",
        logSuccess.join("\n") + "\n",
        (err) => {
          if (err) {
            console.error("Error writing success logs:", err);
          }
        }
      );
    }

    // Escribir logs de error
    if (logError.length) {
      fs.appendFile(
        "logsErrorDeleteAuth0User.txt",
        logError.join("\n") + "\n",
        (err) => {
          if (err) {
            console.error("Error writing error logs:", err);
          }
        }
      );
    }

    // Agregar conteo al final de los logs
    fs.appendFile(
      "logsSummaryDeleteAuth0User.txt",
      `Total users deleted: ${count}\nTotal errors: ${logError.length}\n`,
      (err) => {
        if (err) {
          console.error("Error writing summary logs:", err);
        }
      }
    );

    res.json({
      message: "User deletion process completed",
      totalDeleted: count,
      totalErrors: logError.length,
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }
});

// Ruta para leer datos de MySQL y buscar en Auth0 para actualizar metadata solo genero
app.get("/users/update-metadata-gender-auth0", async (req, res) => {
  const limitParam = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;
  let count = 0;

  try {
    const query = "SELECT * FROM auth0_user LIMIT ? OFFSET ?";
    db.query(query, [limitParam, offset], async (err, results) => {
      if (err) {
        console.error("Error reading data from MySQL:", err);
        return res.status(500).send("Error reading data from MySQL.");
      }

      try {
        const token = await getAuth0Token();

        const usersPromises = results.map((row) =>
          limit(async () => {
            const email = row.Email;
            const gender = getGender(row.gender);

            const auth0User = await getAuth0UserByEmail(token, email);

            if (auth0User) {
              await updateAuth0UserMetadataGender(
                token,
                auth0User.user_id,
                gender
              );
              count++;
              console.log(
                `User metadata updated for Auth0 user in Gender: ${auth0User.user_id} (${count})`
              );
            }

            return { email, auth0User };
          })
        );

        const users = await Promise.all(usersPromises);
        res.json(users);
      } catch (error) {
        console.error("Error updating user metadata:", error);
        res.status(500).send("Error updating user metadata.");
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }
});

// Ruta para leer datos de MySQL y actualizar la fecha de nacimiento en Auth0 si es necesario
app.get("/users/update-metadata-birthday-auth0", async (req, res) => {
  const limitParam = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;
  let count = 0;
  const logSuccess = [];
  const logError = [];

  try {
    const query = "SELECT * FROM users_auth0.auth0_user";
    db.query(query, [limitParam, offset], async (err, results) => {
      if (err) {
        console.error("Error reading data from MySQL:", err);
        return res.status(500).send("Error reading data from MySQL.");
      }

      try {
        const token = await getAuth0Token();

        const usersPromises = results.map((row) =>
          limit(async () => {
            const email = row.Email;
            let birthday = row.birthday;
            console.log("birthday:", birthday);
            // Comprobar si la fecha es válida y puede ser convertida
            if (birthday && shouldConvertBirthday(birthday)) {
              // Convertir el cumpleaños al formato deseado: 'YYYY-MM-DDTHH:mm:ss'
              const formattedBirthday = convertBirthday(birthday);

              if (formattedBirthday) {
                const auth0User = await getAuth0UserByEmail(token, email);

                if (auth0User) {
                  await updateAuth0UserMetadataBirthday(
                    token,
                    auth0User.user_id,
                    formattedBirthday
                  );
                  count++;
                  logSuccess.push(
                    `User metadata updated for Auth0 user in Birthday: ${auth0User.user_id} (${count})`
                  );
                  console.log(
                    `User metadata updated for Auth0 user in Birthday: ${auth0User.user_id} (${count})`
                  );
                }
              } else {
                logError.push(
                  `Skipping user ${email}: unable to convert birthday.`
                );
                console.log(
                  `Skipping user ${email}: unable to convert birthday.`
                );
              }
            } else {
              logError.push(
                `Skipping user ${email}: invalid or null birthday.`
              );
              console.log(`Skipping user ${email}: invalid or null birthday.`);
            }

            return { email };
          })
        );

        const users = await Promise.all(usersPromises);

        // Escribir logs de éxito al final
        if (logSuccess.length) {
          fs.appendFile(
            "logsSuccessUpdateMetadataBirthday.txt",
            logSuccess.join("\n") + "\n",
            (err) => {
              if (err) {
                console.error("Error writing success logs:", err);
              }
            }
          );
        }

        // Escribir logs de error al final
        if (logError.length) {
          fs.appendFile(
            "logsErrorUpdateMetadataBirthday.txt",
            logError.join("\n") + "\n",
            (err) => {
              if (err) {
                console.error("Error writing error logs:", err);
              }
            }
          );
        }

        // Agregar conteo al final de los logs
        fs.appendFile(
          "logsSummaryUpdateMetadataBirthday.txt",
          `Total metadata updates: ${count}\nTotal errors: ${logError.length}\n`,
          (err) => {
            if (err) {
              console.error("Error writing summary logs:", err);
            }
          }
        );

        res.json({ updatedUsers: users.length, totalProcessed: count });
      } catch (error) {
        console.error("Error updating user metadata:", error);
        res.status(500).send("Error updating user metadata.");
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }
});

// Ruta para limpiar la tabla user de MySQL
app.post("/users/clear-table", (req, res) => {
  const query = "TRUNCATE TABLE user";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error truncating table:", err);
      return res.status(500).send("Error truncating table.");
    }
    console.log("Tabla user limpiada.");
    res.send("Tabla user limpiada.");
  });
});
// Ruta para limpiar la tabla user filtered de MySQL
app.post("/users/clear-table-user-filtered", (req, res) => {
  const query = "TRUNCATE TABLE user_filtered";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error truncating table:", err);
      return res.status(500).send("Error truncating table.");
    }
    console.log("Tabla user_filtered limpiada.");
    res.send("Tabla user_filtered limpiada.");
  });
});

// Ruta para limpiar la tabla auth0_user de MySQL
app.post("/users/clear-table-auth0", (req, res) => {
  const query = "TRUNCATE TABLE auth0_user";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error truncating table:", err);
      return res.status(500).send("Error truncating table.");
    }
    console.log("Tabla auth0_user limpiada.");
    res.send("Tabla auth0_user limpiada.");
  });
});

app.get("/users/update-merged-users", async (req, res) => {

    const limitParam = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;
  
    let count = 0;
    const logSuccess = [];
    const logSuccessVtex = [];
    const logSuccessAuth0 = [];
    const logError = [];
  
    try {
      const query = "SELECT * FROM merged_users LIMIT ? OFFSET ?";
      db.query(query, [limitParam, offset], async (err, results) => {
        if (err) {
          console.error("Error reading data from MySQL:", err);
          return res.status(500).send("Error reading data from MySQL.");
        }
  
        try {
          const token = await getAuth0Token();
          let auth0User;
          const usersPromises = results.map((row) =>
            limit(async () => {
              const crmId = row.ContactId;
              const axxNrodocumento = row.axx_nrodocumento;
  
              auth0User = await getAuth0UserByDNI(token, axxNrodocumento);
              console.log("Auth0 user:", auth0User.length);
              //await updateVtexUserData(crmId, crmId);
              if (Array.isArray(auth0User)) {
                for (const user of auth0User) {
                  if (user) {
                    // console.log("User:", user?.user_metadata.user_id_ecommerce);
                    const user_id_ecommerce = user?.user_metadata.user_id_ecommerce ? user.user_metadata.user_id_ecommerce : null;
                    if(user_id_ecommerce){
                        const vtexUpdatedUserResp = await updateVtexUserData(user_id_ecommerce, crmId);
                        // const vtexuser =  await getVtexUserData(user_id_ecommerce);
                        // console.log("Vtex user:", vtexuser);
                        console.log('vtexUpdatedUserResp', vtexUpdatedUserResp);
                        count++;
                        logSuccessVtex.push(
                            `User data updated for VTEX user by DNI: ${user.user_metadata.user_id_ecommerce} (${count})`
                        );
                        console.log(
                            `User data updated for VTEX user: ${user.user_metadata.user_id_ecommerce} (${count})`
                        );
                    }
                    await updateAuth0UserMetadataContactId(
                      token,
                      user.user_id,
                      crmId
                    );
                    count++;
                    logSuccessAuth0.push(
                      `User data updated for Auth0 user by DNI: ${user.user_id} (${count})`
                    );
                    console.log(
                      `User data updated for Auth0 user: ${user.user_id} (${count})`
                    );
                  }
                }
              } else if (auth0User) {
                if(auth0User?.user_metadata?.user_id_ecommerce){
                    const vtexUpdatedUserResp = await updateVtexUserData(auth0User?.user_metadata?.user_id_ecommerce, crmId);
                    console.log('vtexUpdatedUserResp', vtexUpdatedUserResp);
                    // const vtexuser =  await getVtexUserData(auth0User.user_metadata.user_id_ecommerce);
                    // console.log("Vtex user:", vtexuser);
                    count++;
                    logSuccessVtex.push(
                        `User data updated for VTEX user by DNI: ${auth0User.user_metadata.user_id_ecommerce} (${count})`
                    );
                    console.log(
                        `User data updated for VTEX user: ${auth0User.user_metadata.user_id_ecommerce} (${count})`
                    );
                }
                // Fallback para el caso en que auth0User no sea un array (es un solo objeto)
                await updateAuth0UserMetadataContactId(
                    token,
                    auth0User.user_id,
                    crmId
                  );
                count++;
                logSuccessAuth0.push(
                  `User data updated for Auth0 user by DNI: ${auth0User.user_id} (${count})`
                );
                console.log(
                  `User data updated for Auth0 user: ${auth0User.user_id} (${count})`
                );
              } else {
                console.error("No valid auth0User data to process.");
              } 
              return { auth0User };
            })
          );
  
          const users = await Promise.all(usersPromises);
  
        //   // Escribir logs de éxito al final
          if (logSuccessVtex.length) {
            fs.appendFile(
              "logsSuccessUpdateVtexDataByDNI.txt",
              logSuccess.join("\n") + "\n",
              (err) => {
                if (err) {
                  console.error("Error writing success logs:", err);
                }
              }
            );
          }

          if (logSuccessAuth0.length) {
            fs.appendFile(
              "logsSuccessUpdateAuth0DataByDNI.txt",
              logSuccess.join("\n") + "\n",
              (err) => {
                if (err) {
                  console.error("Error writing success logs:", err);
                }
              }
            );
          }
  
        //   // Contar y registrar errores
          const errorCount = logError.length;
          if (errorCount > 0) {
            fs.appendFile(
              "logsErrorUpdateMetadataByDNI.txt",
              logError.join("\n") + "\n",
              (err) => {
                if (err) {
                  console.error("Error writing error logs:", err);
                }
              }
            );
          }
  
        //   // Agregar conteo al final de los logs
          fs.appendFile(
            "logsSummaryUpdateMetadataByDNI.txt",
            `Total metadata updates: ${count}\nTotal errors: ${errorCount}\n`,
            (err) => {
              if (err) {
                console.error("Error writing summary logs:", err);
              }
            }
          );
  
          res.json('Se ha producido la actualización con éxito. Cantidad de usuarios: ', users.length);
        } catch (error) {
          console.error("Error updating user metadata:", error);
          res.status(500).send("Error updating user metadata.");
        }
      });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).send("Error processing request.");
    }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
