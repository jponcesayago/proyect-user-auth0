import express from "express";
import dotenv from "dotenv";
import createRoutes from "./routes/routes-create.js";
import updateRoutes from "./routes/routes-update.js";
import clearRoutes from "./routes/routes-clear.js";
import deleteRoutes from "./routes/routes-delete.js";

dotenv.config();
const app = express();
const port = process.env.PORT ?? 3000;

// Usar las rutas
app.use(createRoutes);
app.use(updateRoutes);
app.use(clearRoutes);
app.use(deleteRoutes);

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});