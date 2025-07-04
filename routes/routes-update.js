import express from "express";
import mysql from "mysql";
import { getAuth0Token, getAuth0UserByEmail, getAuth0UserByDNI, updateAuth0UserMetadataGender, updateAuth0UserMetadataContactId, getAuth0UserByCRMID } from "./../utils/auth0-mitgration.mjs";
import { updateVtexContactId, updateVtexDocument, updateVtexData} from "./../utils/vtex-api-service.mjs";
import pLimit from "p-limit";
import fs from "fs";
import dotenv from "dotenv";

const router = express.Router();
const limit = pLimit(1);

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

// Ruta para leer datos de MySQL y buscar en Auth0 para actualizar metadata
router.get("/users/update-metadata", async (req, res) => {
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

// Ruta para leer datos de MySQL y buscar en Auth0 para actualizar metadata solo genero
router.get("/users/update-metadata-gender-auth0", async (req, res) => {
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
router.get("/users/update-metadata-birthday-auth0", async (req, res) => {
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

// Ruta para leer datos de MySQL y actualizar la fecha de nacimiento en Auth0 si es necesario
router.get("/users/update-merged-users", async (req, res) => {

    const limitParam = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;
  
    let count = 0;
    let count_auth0_users = 0;
    let count__vtex_users = 0;
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
          const usersPromises = results.map((row,index) =>
            limit(async () => {
              const crmId = row.ContactId;
              const auth0_crmdID = row.auth0_crm_id;
              const axxNrodocumento = row.axx_nrodocumento;
              // console.log("row:", row);
              // console.log("ContactId:", crmId);
              // console.log("DNI:", axxNrodocumento);
              // console.log("auth0_crm_id:", auth0_crmdID);
              // auth0User = await getAuth0UserByCRMID(token, auth0_crmdID);
              auth0User = await getAuth0UserByDNI(token, axxNrodocumento);
              if (auth0User.length > 0) {
                count_auth0_users++;
              }
              console.log("Auth0 user:", auth0User);
              console.log("row index:", index);
              if (Array.isArray(auth0User)) {
                for (const user of auth0User) {
                  if (user) {
                    // console.log("User:", user?.user_metadata.user_id_ecommerce);
                    const user_id_ecommerce = user?.user_metadata.user_id_ecommerce ? user.user_metadata.user_id_ecommerce : null;
                    if(user_id_ecommerce){
                        const vtexUpdatedUserResp = await updateVtexContactId(user_id_ecommerce, crmId);
                        // const vtexuser =  await getVtexUserData(user_id_ecommerce);
                        // console.log("Vtex user:", vtexuser);
                        // console.log('vtexUpdatedUserResp', vtexUpdatedUserResp);
                        count__vtex_users++;
                        logSuccessVtex.push(
                            `User data updated for VTEX user by user_id_ecommerce: ${user.user_metadata.user_id_ecommerce} ${user.user_metadata.crm_id} ${crmId} (${count__vtex_users})`
                        );
                        console.log(
                            `User data updated for VTEX user: ${user.user_metadata.user_id_ecommerce} ${user.user_metadata.crm_id} ${crmId} (${count__vtex_users})`
                        );
                    }
                    await updateAuth0UserMetadataContactId(
                      token,
                      user.user_id,
                      crmId
                    );
                    count++;
                    logSuccessAuth0.push(
                      `User data updated for Auth0 user by DNI: ${user.user_id} ${user.user_metadata.crm_id} ${crmId} (${count_auth0_users})`
                    );
                    console.log(
                      `User data updated for Auth0 user: ${user.user_id} ${user.user_metadata.crm_id} ${crmId} (${count_auth0_users})`
                    );
                  }
                }
              } else if (auth0User) {
                if(auth0User?.user_metadata?.user_id_ecommerce){
                    const vtexUpdatedUserResp = await updateVtexContactId(auth0User?.user_metadata?.user_id_ecommerce, crmId);
                    // console.log('vtexUpdatedUserResp', vtexUpdatedUserResp);
                    // const vtexuser =  await getVtexUserData(auth0User.user_metadata.user_id_ecommerce);
                    // console.log("Vtex user:", vtexuser);
                    count++;
                    logSuccessVtex.push(
                        `User data updated for VTEX user by user_id_ecommerce: ${auth0User.user_metadata.user_id_ecommerce} ${auth0User.user_metadata.crm_id} ${crmId} (${count__vtex_users})`
                    );
                    console.log(
                        `User data updated for VTEX user: ${auth0User.user_metadata.user_id_ecommerce} ${auth0User.user_metadata.crm_id} ${crmId} (${count__vtex_users})`
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
                  `User data updated for Auth0 user by DNI: ${auth0User.user_id} ${auth0User.user_metadata.crm_id} ${crmId} (${count_auth0_users})`
                );
                console.log(
                  `User data updated for Auth0 user: ${auth0User.user_id} ${auth0User.user_metadata.crm_id} ${crmId} (${count_auth0_users})`
                );
              } else {
                console.error("No valid auth0User data to process.");
              } 
              return { auth0User };
            })
          );
  
          const users = await Promise.all(usersPromises);
        console.log('coutn_auth0_users:', count_auth0_users);
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
          
          const total_users = count_auth0_users + count__vtex_users;
        //   // Agregar conteo al final de los logs
          fs.appendFile(
            "logsSummaryUpdateMetadataByDNI.txt",
            `Total Auth0 metadata updates: ${count_auth0_users}\n` +
            `Total VTEX metadata updates: ${count__vtex_users}` + "\n" +
            `Total updates: ${total_users}  \n` +
            `Total errors: ${errorCount}\n`,
            (err) => {
              if (err) {
                console.error("Error writing summary logs:", err);
              }
            }
          );
  
          res.json('Se ha producido la actualización con éxito. Cantidad de usuarios: ' + count);
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

//Ruta bulk contact id update in auth0-vtex
router.get("/users/bulk-update-contact-id-auth0-vtex", async (req, res) => {

  const limitParam = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;

  const users= [];
  let count = 0;
  let authUserCount = 0;
  try {
    const query = `SELECT * FROM merged_users LIMIT ? OFFSET ?`;
    db.query(query, [limitParam, offset], async (err, results) => {
      if (err) {
        console.error("Error reading data from MySQL:", err);
        return res.status(500).send("Error reading data from MySQL.");
      }
      const userPromises = await results.map((row,index) => {
        console.log('autho-user: ', index);
        

      });

      const users = await Promise.all(userPromises);

      console.log('results:', results.length);
      console.log('users found: ', users);
      res.json(`${results.length} users updated`);


    });
    
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }
});

// Ruta para leer datos de MySQL y actualizar VNI en Vtex si es necesario
router.get("/users/update-vtex-users-dni", async (req, res) => {

  const limitParam = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;

  let count = 0;
  let count_auth0_users = 0;
  let count__vtex_users = 0;
  const logSuccess = [];
  const logSuccessVtex = [];
  const logSuccessAuth0 = [];
  const logError = [];

  try {
    const query = "SELECT * FROM vtex_users_email LIMIT ? OFFSET ?";
    db.query(query, [limitParam, offset], async (err, results) => {
      if (err) {
        console.error("Error reading data from MySQL:", err);
        return res.status(500).send("Error reading data from MySQL.");
      }

      try {
        const token = await getAuth0Token();
        let auth0User;
        const usersPromises = results.map((row,index) =>
          limit(async () => {
            const auth0_email = row.email;
            // console.log("row:", row);
            auth0User = await getAuth0UserByEmail(token, auth0_email);
            if (auth0User.length > 0) {
              count_auth0_users++;
            }
            console.log("Auth0 user:", auth0User);
            console.log("row index:", index);
            if (Array.isArray(auth0User)) {
              for (const user of auth0User) {
                if (user) {
                  const document = user?.user_metadata.taxvat ? user.user_metadata.taxvat : null;
                  const user_id_ecommerce = user?.user_metadata.user_id_ecommerce ? user.user_metadata.user_id_ecommerce : null;
                  const user_metadata = user?.user_metadata ? user.user_metadata : null;
                  // console.log("User:", user?.user_metadata.user_id_ecommerce);
                  if(user_id_ecommerce&&document){
                      // const vtexUpdatedUserResp = await updateVtexDocument(user_id_ecommerce, document);
                      // const vtexUpdatedUserResp = await updateVtexData(user_id_ecommerce, user_metadata);
                      count__vtex_users++;
                      logSuccessVtex.push(
                          `User data updated for VTEX user by user_id_ecommerce: ${user.user_metadata.user_id_ecommerce} ${user.user_metadata.crm_id} ${document} (${count__vtex_users})`
                      );
                      console.log(
                          `User data updated for VTEX user: ${user.user_metadata.user_id_ecommerce} ${user.user_metadata.crm_id} ${document} (${count__vtex_users})`
                      );
                  }else{	
                      logError.push(`User data not updated for VTEX user by user_id_ecommerce: ${auth0_email}  ${user.user_metadata?.crm_id} ${document} (${count__vtex_users})`);
                      console.log(`User data not updated for VTEX user: ${auth0_email}   ${user.user_metadata?.crm_id} ${document} (${count__vtex_users})`);
                  }
                }
              }
            } else if (auth0User) {
              if(auth0User.user_metadata.taxvat && auth0User.user_metadata.user_id_ecommerce){
                  const user_metadata = auth0User.user_metadata;
                  // const vtexUpdatedUserResp = await updateVtexData(auth0User.user_metadata.user_id_ecommerce, user_metadata);
                  count++;
                  logSuccessVtex.push(
                      `User data updated for VTEX user by user_id_ecommerce: ${auth0User.user_metadata.user_id_ecommerce} ${auth0User.user_metadata.crm_id} ${auth0User.user_metadata.taxvat} (${count__vtex_users})`
                  );
                  console.log(
                      `User data updated for VTEX user: ${auth0User.user_metadata.user_id_ecommerce} ${auth0User.user_metadata.crm_id} ${auth0User.user_metadata.taxvat} (${count__vtex_users})`
                  );
              }else{	
                logError.push(`User data not updated for VTEX user by user_id_ecommerce: ${auth0_email}  ${auth0User.user_metadata?.crm_id} ${auth0User.user_metadata.taxvat} (${count__vtex_users})`);
                console.log(`User data not updated for VTEX user: ${auth0_email} ${auth0User.user_metadata?.crm_id} ${auth0User.user_metadata.taxvat} (${count__vtex_users})`);
            }
            } else {
              console.error("No valid auth0User data to process.");
            } 
            return { auth0User };
          })
        );

        const users = await Promise.all(usersPromises);
        console.log('coutn_auth0_users:', count_auth0_users);
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
        
        const total_users = count_auth0_users + count__vtex_users;
      //   // Agregar conteo al final de los logs
        fs.appendFile(
          "logsSummaryUpdateMetadataByDNI.txt",
          `Total Auth0 metadata updates: ${count_auth0_users}\n` +
          `Total VTEX metadata updates: ${count__vtex_users}` + "\n" +
          `Total updates: ${total_users}  \n` +
          `Total errors: ${errorCount}\n`,
          (err) => {
            if (err) {
              console.error("Error writing summary logs:", err);
            }
          }
        );

        res.json('Se ha producido la actualización con éxito. Cantidad de usuarios: ' + count);
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


//Ruta para eliminar parametro crm_id si es igual a ""

router.get("/users/delete-crm-id", async (req, res) => {
   try {
          const token = await getAuth0Token();
          let auth0User;
          auth0User = await getAuth0UserByCRMID(token, "");
          console.log("Auth0 user:", auth0User);
          let count = 0;
          const logSuccessAuth0 = [];
          const logError = [];

          if (Array.isArray(auth0User)) {
            for (const user of auth0User) {
              if (user) {
      
                await updateAuth0UserMetadataContactId(
                  token,
                  user.user_id,
                  null
                );
                count++;
                logSuccessAuth0.push(
                  `User data updated for Auth0 user by CRM ID: ${user.user_id} ${user.email} (${count})`
                );
                console.log(
                  `User data updated for Auth0 user: ${user.user_id} ${user.email} (${count})`
                );
              }
            }
          }

          if (logSuccessAuth0.length) {
            fs.appendFile(
              "logsSuccessUpdateAuth0DataB_CRM_ID.txt",
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
              "logsErrorUpdateMetadataBy_CRM_ID.txt",
              logError.join("\n") + "\n",
              (err) => {
                if (err) {
                  console.error("Error writing error logs:", err);
                }
              }
            );
          }
          
          const count_auth0_users = logSuccessAuth0.length;
        const total_users = count_auth0_users;
        //   // Agregar conteo al final de los logs
          fs.appendFile(
            "logsSummaryUpdateMetadataByDNI.txt",
            `Total Auth0 metadata updates: ${count_auth0_users}\n` +
            `Total updates: ${total_users}  \n` +
            `Total errors: ${errorCount}\n`,
            (err) => {
              if (err) {
                console.error("Error writing summary logs:", err);
              }
            }
          );
  
          res.json('Se ha producido la actualización con éxito. Cantidad de usuarios: ' + count);
        } catch (error) {
          console.error("Error updating user metadata:", error);
          res.status(500).send("Error updating user metadata.");
        }
});
export default router;