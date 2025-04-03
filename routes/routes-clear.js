import express from "express";
import mysql from "mysql";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

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
  
  // Ruta para limpiar la tabla user de MySQL
router.post("/users/clear-table", (req, res) => {
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
router.post("/users/clear-table-user-filtered", (req, res) => {
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
router.post("/users/clear-table-auth0", (req, res) => {
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



export default router;