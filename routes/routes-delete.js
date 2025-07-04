import express from "express";
import { getAuth0Token, getAuth0UserByEmail, deleteUserInAuth0 } from "./../utils/auth0-mitgration.mjs";
import pLimit from "p-limit";
import mysql from "mysql";
import dotenv from "dotenv";
import fs from "fs";
import { deleteVtexUserById, getVtexUserData, getVtexUserDataByEmail } from "../utils/vtex-api-service.mjs";

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

// Ruta para borrar usuario en Auth0 por email leido de la tabla auth0_user
router.get("/users/delete-auth0-user", async (req, res) => {
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
router.get("/users/delete-auth0-user-by-email-array", async (req, res) => {
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


// Ruta para borrar usuario en Auth0 que posean cuits y tipo de documento distinto a 246 o 96 por email leido de la tabla auth0_user
router.get("/users/delete-cuit-auth0-user", async (req, res) => {
  const limitParam = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;

  let count = 0;
  const logSuccess = [];
  const logError = [];

  try {
    // const query = "SELECT * FROM auth0_user LIMIT ? OFFSET ?";
    const query = `
      SELECT * FROM auth0_user
      WHERE (taxvat_type NOT IN (246, 96, "246", "96", "'246", "'96","") OR taxvat_type IS NULL)
      OR (LENGTH(REPLACE(taxvat, ' ', '')) > 8 OR taxvat IS NULL)
    `;
    db.query(query, [limitParam, offset], async (err, results) => {
      if (err) {
        console.error("Error reading data from MySQL:", err);
        return res.status(500).send("Error reading data from MySQL.");
      }

      console.log("Results:", results.length);
      try {
        const token = await getAuth0Token();

        const usersPromises = results.map((row) =>
          limit(async () => {
            const email = row.Email;
            // console.log("Email:", email);
            const auth0User = await getAuth0UserByEmail(token, email);

            if (auth0User) {
              // await deleteUserInAuth0(auth0User.user_id, token);
              count++;
              logSuccess.push(
                `User deleted in Auth0: ${auth0User.user_id} (${count})`
              );
              console.log(
                `User deleted in Auth0: ${auth0User.user_id} (${count})`
              );
            }else{
              logError.push(
                `User not found in Auth0 for email: ${email}`
              );
              console.error(`User not found in Auth0 for email: ${email}`);
            }

            return { email, auth0User };
          })
        );

        const users = await Promise.all(usersPromises);
        console.log("Users to delete:", users.length);
        // Escribir logs de éxito al final
        if (logSuccess.length) {
          fs.appendFile(
            "logsSuccessDeleteCuitAuth0User.txt",
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
            "logsErrorDeleteCuitAuth0User.txt",
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
          "logsSummaryDeleteCuitAuth0User.txt",
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

// Ruta parar borrar usuario vtex con cuit/cuil
router.get("/users/delete-cuit-vtex-user", (req, res) => {

  const limitParam = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;

  let count = 0;
  const logSuccess = [];
  const logError = [];

    try {
    // const query = "SELECT * FROM auth0_user LIMIT ? OFFSET ?";
    const query = `
      SELECT * FROM vtex_users_2
      WHERE CHAR_LENGTH(TRIM(document)) > 8
    `;
    db.query(query, [limitParam, offset], async (err, results) => {
      if (err) {
        console.error("Error reading data from MySQL:", err);
        return res.status(500).send("Error reading data from MySQL.");
      }

      console.log("Results:", results.length);
      try {
 

        const usersPromises = results.map((row) =>
          limit(async () => {
            const email = row.email;
            const user_id_ecommerce = row.userId;
            // console.log("Email:", email);
            console.log("user_id_ecommerce:", user_id_ecommerce);
            const vtex_user = await getVtexUserDataByEmail(email);
            console.log("vtex_user:", vtex_user);
            if (vtex_user) {
              //await deleteVtexUserById(user_id_ecommerce);
              count++;
              logSuccess.push(
                `User deleted in Vtex: ${user_id_ecommerce} (${count})`
              );
              console.log(
                `User deleted in Vtex: ${user_id_ecommerce} (${count})`
              );
            }else{
              logError.push(
                `User not found in Vtex for email: ${email}`
              );
              console.error(`User not found in Vtex for email: ${email}`);
            }

            return { email, vtex_user };
          })
        );

        const users = await Promise.all(usersPromises);
        console.log("Users to delete:", users.length);
        // Escribir logs de éxito al final
        if (logSuccess.length) {
          fs.appendFile(
            "logsSuccessDeleteCuitVtexUser.txt",
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
            "logsErrorDeleteCuitVtex0User.txt",
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
          "logsSummaryDeleteCuitVtexUser.txt",
          `Total users deleted: ${count}\nTotal errors: ${errorCount}\n`,
          (err) => {
            if (err) {
              console.error("Error writing summary logs:", err);
            }
          }
        );

        res.json(users);
      } catch (error) {
        console.error("Error deleting user in Vtex:", error);
        res.status(500).send("Error deleting user in Vtex.");
      }
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }

});




export default router;