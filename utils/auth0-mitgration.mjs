// const axios = require("axios");
// const moment = require("moment");
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

// Configuración de Auth0
const auth0Domain = process.env.AUTH0_DOMAIN;
const auth0ClientId = process.env.AUTH0_CLIENT_ID;
const auth0ClientSecret = process.env.AUTH0_CLIENT_SECRET;
const auth0Audience = process.env.AUTH0_AUDIENCE;

// Obtener token de acceso de Auth0
async function getAuth0Token() {
  try {
    console.log("auth0Domain", auth0Domain);
    const response = await axios.post(`https://${auth0Domain}/oauth/token`, {
      client_id: auth0ClientId,
      client_secret: auth0ClientSecret,
      audience: auth0Audience,
      grant_type: "client_credentials",
    });
    console.log("Auth0 token:", response.data.access_token);
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting Auth0 token:", error);
  }
}

// Función para eliminar un usuario en Auth0
async function deleteUserInAuth0(userId, token) {
  try {
    const response = await axios.delete(
      `https://${auth0Domain}/api/v2/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log(`Usuario ${userId} eliminado exitosamente en Auth0`);
    return response.status;
  } catch (error) {
    const errorMessage = error.response
      ? `${error.response.status} - ${error.response.data.error}: ${error.response.data.error_description}`
      : error.message;

    console.error(
      `Error eliminando el usuario ${userId} en Auth0: ${errorMessage}`
    );
    throw new Error(`Error eliminando el usuario ${userId}: ${errorMessage}`);
  }
}

// Buscar usuario en Auth0 por email
async function getAuth0UserByEmail(token, email) {
  try {
    const response = await axios.get(
      `https://${auth0Domain}/api/v2/users-by-email`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        params: {
          email: email,
        },
      }
    );
    console.log("Auth0 user by email:", response.data[0]);
    return response.data[0]; // Retorna el primer usuario encontrado
  } catch (error) {
    console.error("Error getting Auth0 user by email:", error);
  }
}

// Buscar usuario en Auth0 por DNI u otro dato en los metadatos
async function getAuth0UserByDNI(token, dni) {
  try {
    console.log("dni", dni);
    const response = await axios.get(`https://${auth0Domain}/api/v2/users?q=user_metadata.taxvat:("${dni}")&search_engine=v3`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // console.log("Auth0 user by DNI:", response.data);
    return response.data; // Retorna el primer usuario encontrado por DNI
  } catch (error) {
    console.error("Error getting Auth0 user by DNI:", error);
  }
}

// Buscar usuario en Auth0 por CRM ID u otro dato en los metadatos
async function getAuth0UserByCRMID(token, crm_id) {
  try {
    const response = await axios.get(`https://${auth0Domain}/api/v2/users?q=user_metadata.crm_id:("${crm_id.toLowerCase()}"OR"${crm_id.toUpperCase()}")&search_engine=v3`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // console.log("Auth0 user by DNI:", response.data);
    return response.data; // Retorna el primer usuario encontrado por DNI
  } catch (error) {
    console.error("Error getting Auth0 user by DNI:", error);
  }
}

// Función para obtener el género en el formato esperado
function getGender(genderCode) {
  switch (genderCode) {
    case 1:
    case "1":
    case "masc":
    case "masculino":
    case "Masculino":
    case "MASCULINO":
      return "Masculino";
    case 2:
    case "2":
    case "fem":
    case "femenino":
    case "Femenino":
    case "FEMENINO":
      return "Femenino";
    default:
      return "Masculino";
  }
}

// Función para obtener todos los registros de la tabla user por su email único en la tabla de user
const getAllUsersByUniqueEmailAndStatusActive = async () => {
  return new Promise((resolve, reject) => {
    const query = `
            WITH RankedUsers AS (
                SELECT 
                    *,
                    ROW_NUMBER() OVER (
                        PARTITION BY axx_nrodocumento
                        ORDER BY 
                            q_susc_activas DESC,  -- Prioridad: mayor valor en "q_susc_activas"
                            created_on ASC         -- Desempate: el más antiguo
                    ) AS rn
                FROM user
            )
            SELECT *
            FROM RankedUsers
            WHERE rn = 1; -- Seleccionar solo el mejor registro por cada axx_nrodocumento
        `;

    db.query(query, (err, results) => {
      if (err) {
        console.error("Error fetching data from user table:", err);
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};

// Función para encontrar un usuario en la tabla auth0_user por email
const findMatchingAuth0User = async (email) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM auth0_user WHERE Email = ?";
    const values = [email];
    db.query(query, values, (err, results) => {
      if (err) {
        console.error("Error finding matching user in auth0_user table:", err);
        reject(err);
      } else {
        if (results.length > 0) {
          resolve(results[0]); // Retorna el primer usuario encontrado
        } else {
          resolve(null); // Retorna null si no se encuentra ningún usuario
        }
      }
    });
  });
};

// Función para encontrar un usuario en la tabla auth0_user por DNI y que no lo haya encontrado por email
async function findMatchingAuth0UserByDni(email, dni) {
  return new Promise((resolve, reject) => {
    // Primer intento: buscar por email
    const queryByEmail =
      "SELECT * FROM auth0_user WHERE LOWER(Email) = LOWER(?)";
    db.query(queryByEmail, [email], (err, resultsByEmail) => {
      if (err) {
        console.error(
          "Error finding matching user by email in auth0_user table:",
          err
        );
        return reject(err);
      }

      if (resultsByEmail.length > 0) {
        // Usuario encontrado por email, no continuamos con la búsqueda por DNI
        return resolve(null);
      }

      // Si no se encuentra por email, intentar buscar por DNI
      const queryByDNI = "SELECT * FROM auth0_user WHERE taxvat = ?";
      db.query(queryByDNI, [dni], (err, resultsByDNI) => {
        if (err) {
          console.error(
            "Error finding matching user by DNI in auth0_user table:",
            err
          );
          return reject(err);
        }

        if (resultsByDNI.length > 0) {
          return resolve(resultsByDNI[0]); // Usuario encontrado por DNI
        } else {
          return resolve(null); // No se encontró ningún usuario
        }
      });
    });
  });
}

// Función para encontrar un usuario en la tabla auth0_user solo por DNI
const findMatchingAuth0UserOnlyByDni = async (dni) => {
  return new Promise((resolve, reject) => {
    const queryByDNI = "SELECT * FROM auth0_user WHERE taxvat = ?";
    db.query(queryByDNI, [dni], (err, resultsByDNI) => {
      if (err) {
        console.error(
          "Error finding matching user by DNI in auth0_user table:",
          err
        );
        return reject(err);
      }

      if (resultsByDNI.length > 0) {
        return resolve(resultsByDNI[0]); // Usuario encontrado por DNI
      } else {
        return resolve(null); // No se encontró ningún usuario
      }
    });
  });
};

// Función para actualizar el metadata del usuario en Auth0
async function updateAuth0UserMetadataSuscActivas(token, userId, suscActivas) {
  try {
    await axios.patch(
      `https://${auth0Domain}/api/v2/users/${userId}`,
      {
        user_metadata: {
          active_subs: suscActivas,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    console.error(
      `Error updating user metadata for Auth0 user ${userId}:`,
      error
    );
  }
}

// Función para actualizar el metadata del usuario en Auth0
async function updateAuth0UserMetadataContactId(
  token,
  userId,
  barricaContactId
) {
  try {
    await axios.patch(
      `https://${auth0Domain}/api/v2/users/${userId}`,
      {
        user_metadata: {
          crm_id: barricaContactId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    console.error(
      `Error updating user metadata for Auth0 user ${userId}:`,
      error
    );
  }
}

// Función para actualizar el metadata del usuario en Auth0 solo genero
async function updateAuth0UserMetadataGender(token, userId, gender) {
  try {
    await axios.patch(
      `https://${auth0Domain}/api/v2/users/${userId}`,
      {
        user_metadata: {
          gender: gender,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    console.error(
      `Error updating user metadata for Auth0 user in Gender ${userId}:`,
      error
    );
  }
}

// Función para actualizar el metadata del usuario en Auth0 solo fecha de nacimiento
async function updateAuth0UserMetadataBirthday(token, userId, birthDate) {
  try {
    await axios.patch(
      `https://${auth0Domain}/api/v2/users/${userId}`,
      {
        user_metadata: {
          birthday: birthDate,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    console.error(
      `Error updating user metadata for Auth0 user in Birthday ${userId}:`,
      error
    );
  }
}

// Función para determinar si la fecha de cumpleaños debe ser convertida
function shouldConvertBirthday(birthday) {
  const dateFormatsRegex = /^\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}$/;
  const fullDateTimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/;
  const isBirthdayValid =
    dateFormatsRegex.test(birthday) || fullDateTimeRegex.test(birthday);
  console.log("Birthday test:", isBirthdayValid);
  return isBirthdayValid;
}

// Función para convertir la fecha al formato 'YYYY-MM-DD 02:00:00.000'
const convertBirthday = (birthday) => {
  let parsedDate;

  if (/^\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2}$/.test(birthday)) {
    parsedDate = moment(birthday, ["DD-MM-YY", "DD/MM/YY", "DD.MM.YY"]);
  } else if (/^\d{1,2}[-\/.]\d{1,2}[-\/.]\d{4}$/.test(birthday)) {
    parsedDate = moment(birthday, ["DD-MM-YYYY", "DD/MM/YYYY", "DD.MM.YYYY"]);
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/.test(birthday)) {
    parsedDate = moment(birthday, "YYYY-MM-DD HH:mm:ss.SSS");
  }

  if (parsedDate && parsedDate.isValid()) {
    return parsedDate.format("YYYY-MM-DDTHH:mm:ss");
  }

  return null;
};

// auth0-mitgration.mjs
export {
  getAuth0Token,
  deleteUserInAuth0,
  getAuth0UserByEmail,
  getAuth0UserByDNI,
  getGender,
  getAllUsersByUniqueEmailAndStatusActive,
  findMatchingAuth0User,
  findMatchingAuth0UserByDni,
  findMatchingAuth0UserOnlyByDni,
  updateAuth0UserMetadataSuscActivas,
  updateAuth0UserMetadataContactId,
  updateAuth0UserMetadataGender,
  updateAuth0UserMetadataBirthday,
  shouldConvertBirthday,
  convertBirthday,
  getAuth0UserByCRMID
};
