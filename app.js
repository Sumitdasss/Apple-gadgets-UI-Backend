import "dotenv/config";
import express from "express";
import cors from "cors";
import DNS from "dns";

import { connectDB } from "./config/db.js";
import router from "./routes/index.js";

DNS.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();

// ================= DATABASE =================
connectDB();

// ================= CORS =================
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://apple-gadgets-ui.vercel.app",
      "https://apple-gadgets-ui-adminpanel.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);

// ================= BODY PARSER =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= ROUTES =================
app.use("/products", router);
app.use("/facebook", router);
app.use("/category", router);
app.use("/api/dashboard", router);

export default app;
