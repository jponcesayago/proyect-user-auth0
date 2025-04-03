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
import clearRoutes from "./routes/routes-clear.js";
import createRoutes from "./routes/routes-create.js";
import uploadRoutes from "./routes/routes-upload.js";
import updateRoutes from "./routes/routes-update.js";
import deleteRoutes from "./routes/routes-delete.js";

import { getVtexUserData, updateVtexUserData } from "./utils/vtex-api-service.mjs";

// Cargar variables de entorno desde el archivo .env
dotenv.config();
const app = express();
const port = process.env.PORT ?? 3000;

// Ruta de prueba para verificar que el servidor está funcionando
app.get("/", (req, res) => {
  res.send("Servidor Express funcionando correctamente.");
});

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
app.use(clearRoutes);
app.use(createRoutes);
app.use(uploadRoutes);
app.use(updateRoutes);
app.use(deleteRoutes);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
