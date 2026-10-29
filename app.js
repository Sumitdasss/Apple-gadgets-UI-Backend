import "dotenv/config";
import express from "express";
import cors from "cors";
import DNS from "dns";

import  {connectDB}  from "./config/db.js";
import router from "./routes/index.js";
import { apiResponse } from "./utils/ApiResponse.js";
import cookieParser from "cookie-parser";


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
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// ================= ROUTES =================
app.use("/products", router);
app.use("/api/users", router);
app.use("/facebook", router);
app.use("/category", router);
app.use("/api/orders",  router);
app.use("/api/dashboard", router);
app.use("/api/customers", router);
app.use("/api/landing-pages", router);
app.use("/api/payment/sslcommerz", router);
app.use("/api/cron", router);
app.use("/api/admin-auth", router);






app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
apiResponse(res, statusCode, err.message || "Internal server error", null);

});
export default app;
