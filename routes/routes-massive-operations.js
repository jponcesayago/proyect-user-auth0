import express from "express";
import { getAuth0Token, getAuth0UserByEmail, deleteUserInAuth0, findMatchingAuth0UserOnlyByDni } from "./../utils/auth0-mitgration.mjs";
import pLimit from "p-limit";
import mysql from "mysql";
import dotenv from "dotenv";

dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the MySQL database.");
});

const router = express.Router();
const limit = pLimit(1); // Ajusta este valor según tus necesidades y límites de Auth0


// Ruta para leer datos de MySQL
router.get("/users", (req, res) => {
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
  router.get("/users/auth0-search", async (req, res) => {
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
  router.get("/users/search", (req, res) => {
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
  router.get("/users/filter-and-find", async (req, res) => {
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
  router.get("/users/filter-and-find-dni", async (req, res) => {
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
  
  let count = 0;
  // Ruta para leer datos de MySQL
  router.get("/users/count-auth0-users", (req, res) => {
    const query = "SELECT * FROM merged_users";
    let count = 0;
    const logSuccessVtex = [];
    const logSuccessAuth0 = [];
    const logError = [];
    const logNotExistUserVtex = [];
    try {
      db.query(query, async (err, results) => {
        if (err) {
          console.error("Error reading data from MySQL:", err);
          return res.status(500).send("Error reading data from MySQL.");
        }
    
        try {
          const token = await getAuth0Token();
          let auth0User;
    
          for (const row of results) {
            console.log("Row counter:", count);
            const crmId = row.ContactId;
            const axxNrodocumento = row.axx_nrodocumento;
            auth0User = await getAuth0UserByDNI(token, axxNrodocumento);
            if (Array.isArray(auth0User)) {
              for (const user of auth0User) {
                if (user) {
                  count++;
                  if (user.user_metadata.user_id_ecommerce){
                    logSuccessVtex.push(
                      `User data updated for VTEX user by user_id_ecommerce: ${user.user_metadata.user_id_ecommerce} ${user.user_metadata.crm_id} ${crmId} (${count})`
                  );
                  }else{
                    logNotExistUserVtex.push(
                      `User do not exist in vtex: ${user.last_login} ${user.user_id} ${user.user_metadata.crm_id} ${crmId} (${count})`
                    );
                  }
                  logSuccessAuth0.push(
                    `User data updated for Auth0 user by DNI: ${user.user_id} ${user.user_metadata.crm_id} ${crmId} (${count})`
                  );
                }
              }
            } else if (auth0User) {
              count++;
              if (auth0User.user_metadata.user_id_ecommerce){
                logSuccessVtex.push(
                  `User data updated for VTEX user by user_id_ecommerce: ${auth0User.user_metadata.user_id_ecommerce} ${auth0User.user_metadata.crm_id} ${crmId} (${count})`
              );
              }else{
                logNotExistUserVtex.push(
                  `User do not exist in vtex: ${auth0User.last_login} ${auth0User.user_id} ${auth0User.user_metadata.crm_id} ${crmId} (${count})`
                );
              }
              logSuccessAuth0.push(
                `User data updated for Auth0 user by DNI: ${auth0User.user_id} ${auth0User.user_metadata.crm_id} ${crmId} (${count})`
              );
            }
          }
        } catch (error) {
          console.error("Error processing request:", error);
          res.status(500).send("Error processing request.");
        }
  
  
         //   // Escribir logs de éxito al final
         if (logSuccessVtex.length) {
          fs.appendFile(
            "logsSuccessUpdateVtexDataByDNI.txt",
            logSuccessVtex.join("\n") + "\n",
            (err) => {
              if (err) {
                console.error("Error writing success logs:", err);
              }
            }
          );
        }
  
         //   // Escribir logs de éxito al final
         if (logNotExistUserVtex.length) {
          fs.appendFile(
            "logsNotExistVtexData.txt",
            logNotExistUserVtex.join("\n") + "\n",
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
            logSuccessAuth0.join("\n") + "\n",
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
        console.log("Total de usuarios en Merged:", results.length);
        console.log("Total de usuarios en Auth0:", count);
        res.json({ totalUsers: count });
      });
    } catch (error) {
      console.error("Error processing request:", error);
      res.status(500).send("Error processing request.");
      
    }
   
  });
  
  // const logsFilePath = path.join(__dirname, );
  
  // Función para procesar y ordenar los logs
  function processLogs() {
    // Leer el archivo de logs
    const logsContent = fs.readFileSync('logsNotExistVtexData.txt', 'utf-8');
  
    // Dividir el contenido en líneas
    const logsLines = logsContent.split('\n');
  
    // Crear un array de objetos con la fecha y la línea completa
    const logsWithDates = logsLines.map(line => {
        const dateMatch = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
        const date = dateMatch ? new Date(dateMatch[0]) : null;
        return { date, line };
    });
  
    // Filtrar las líneas que no tienen fecha válida
    const validLogs = logsWithDates.filter(log => log.date !== null);
  
    // Ordenar las líneas por fecha (de más reciente a más antigua)
    validLogs.sort((a, b) => b.date - a.date);
  
    // Extraer solo las líneas ordenadas
    const sortedLogs = validLogs.map(log => log.line);
  
    return sortedLogs;
  }
  
  //Ruta procesamiento usuario no existentes en vtex
  router.get("/users/sort-not-exist-vtex-users", (req, res) => {
    const sortedLogs = processLogs();
    console.log('Logs ordenados:', sortedLogs);
    res.json(sortedLogs);
  });

export default router;
