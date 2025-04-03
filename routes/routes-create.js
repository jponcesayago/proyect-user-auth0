import express from "express";
import multer from "multer";
import mysql from "mysql";
import csv from "csv-parser";
import fs from "fs";
import path from "path";
import { getAllUsersByUniqueEmailAndStatusActive, findMatchingAuth0User } from "./../utils/auth0-mitgration.mjs";
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

// Ruta para crear la tabla `user` en MySQL
router.get("/users/create-table-users", (req, res) => {
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
router.get("/users/create-table-users-filtered", (req, res) => {
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
router.get("/users/create-table-auth0-users", (req, res) => {
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

export default router;