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
async function updateVtexContactId(user_id_ecommerce, barricaContactId) {
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


// aCTUALIZAR DATOS DE USUARIO EN VTEX
async function updateVtexDocument(user_id_ecommerce, document) {
  try {
    // console.log("user_id_ecommerce", user_id_ecommerce);
    const response = await axios.patch(
      `${vtexApiService}/dataentities/CL/documents/${user_id_ecommerce}`,
      {
        document: document,
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

// aCTUALIZAR DATOS DE USUARIO EN VTEX
async function updateVtexData(
  user_id_ecommerce, 
  { first_name, last_name, taxvat, active_subs, crm_id }
) {
  try {
    const updateData = {};

    const isValid = (value) => {
      return value !== undefined && value !== null && value !== "";
    };
    
    // Solo agregamos los campos que nos hayan proporcionado
    if (isValid(first_name)) updateData.firstName = first_name;
    if (isValid(last_name)) updateData.lastName = last_name;
    if (isValid(taxvat)) updateData.document = taxvat;
    if (isValid(active_subs)) updateData.socioBonvivir = active_subs >= 1 ? true : false;
    if (isValid(crm_id)) updateData.barricaContactId = crm_id;

    console.log('updateData',updateData)
    const response = await axios.patch(
      `${vtexApiService}/dataentities/CL/documents/${user_id_ecommerce}`,
      updateData,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-VTEX-API-AppKey": vtexApiAppKey,
          "X-VTEX-API-AppToken": vtexApiToken,
        },
      }
    );
    return response;
  } catch (error) {
    console.error("Error updating Vtex data:", error);
    throw error; // Es buena práctica relanzar el error para que el llamador pueda manejarlo
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

async function getVtexUserDataByEmail(email) {
  try {
    const response = await axios.get(
      `${vtexApiService}/dataentities/CL/search?_fields=barricaContactId,email,document,id,firstName,lastName,socioBonvivir,phone&_where=email=${email}`,
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


async function deleteVtexUserById(user_id_ecommerce) {
  try {
    const response = await axios.delete(
      `${vtexApiService}/dataentities/CL/documents/${user_id_ecommerce}`,
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
    console.error("Error delete Vtex user by id;", error);
  }
}
export { updateVtexContactId, getVtexUserData, updateVtexDocument, updateVtexData, deleteVtexUserById, getVtexUserDataByEmail };
