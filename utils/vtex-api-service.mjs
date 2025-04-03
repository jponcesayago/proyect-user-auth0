import axios from "axios";
import moment from "moment";
import mysql from "mysql";
import dotenv from "dotenv";

dotenv.config();
// Configuración de la base de datos MySQL
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

const vtexApiService = process.env.VTEX_API_URL;
const vtexApiToken = process.env.X_VTEX_API_APPTOKEN;
const vtexApiAppKey = process.env.X_VTEX_API_APPKEY;

// aCTUALIZAR DATOS DE USUARIO EN VTEX
async function updateVtexUserData(user_id_ecommerce, barricaContactId) {
  try {
    // console.log("user_id_ecommerce", user_id_ecommerce);
    const response = await axios.patch(
      `${vtexApiService}/dataentities/CL/documents/${user_id_ecommerce}`,
      {
        barricaContactId: barricaContactId,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-VTEX-API-AppKey": vtexApiAppKey,
          "X-VTEX-API-AppToken": vtexApiToken,
        },
      }
    );
    // console.log("Vtex response:", response);
    return response;
  } catch (error) {
    console.error("Error update Vtex data;", error);
  }
}

async function getVtexUserData(user_id_ecommerce) {
  try {
    const response = await axios.get(
      `${vtexApiService}/dataentities/CL/documents/${user_id_ecommerce}?_fields=barricaContactId,email,document,id`,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-VTEX-API-AppKey": vtexApiAppKey,
          "X-VTEX-API-AppToken": vtexApiToken,
        },
      }
    );
    // console.log("Vtex response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error get Vtex data;", error);
  }
}
export { updateVtexUserData, getVtexUserData };
