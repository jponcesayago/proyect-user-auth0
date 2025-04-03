import express from "express";
import multer from "multer";
import mysql from "mysql";
import csv from "csv-parser";
import fs from "fs";
import path from "path";
import { getAllUsersByUniqueEmailAndStatusActive, findMatchingAuth0User } from "../utils/auth0-mitgration.mjs";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

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

// Ruta para subir el archivo de Logging txt del proceso de mergeo de contactos a la tabla merged_users en MySQL
router.post(
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
router.post(
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
router.post("/users/upload-file", upload.single("file"), async (req, res) => {
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


export default router;
