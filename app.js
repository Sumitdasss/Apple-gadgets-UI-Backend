import express from "express";
import cors from "cors";
import DNS from "dns";
import dotenv from "dotenv";

import { connectDB } from "./config/db.js";
import router from "./routes/index.js";

DNS.setServers(["1.1.1.1", "8.8.8.8"]);

dotenv.config();

const app = express();

// ================= DATABASE =================
connectDB();

// ================= CORS =================
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://apple-gadgets-ui.vercel.app",
    ],
    credentials: true,
  })
);

// ================= BODY PARSER =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================= ROUTES =================
app.use("/", router);
app.use("/api/Facebook" ,router)


export default app;