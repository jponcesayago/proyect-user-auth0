import axios from "axios";
import dotenv from "dotenv";

dotenv.config();


const kiwiApiService = process.env.URL_PROXY_KIWI;
const kiwiApiApiKey = process.env.KIWI_PROXY_API_KEY;


async function getBarricaUserData(gender,dni_number) {
  try {
    const response = await axios.get(
      `${kiwiApiService}/contact.json?idType=D.N.I.&gender=${gender}&idNumber=${dni_number}`,
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "'x-api-key'": kiwiApiApiKey
        },
      }
    );
    // console.log("Vtex response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error get Vtex data;", error);
  }
}
export { getBarricaUserData };
