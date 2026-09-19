import  express from 'express';
import cors from 'cors';
import DNS from 'dns';
DNS.setServers(["1.1.1.1", "8.8.8.8"]);
import dotenv from 'dotenv';
dotenv.config();
connectDB();
import router from './routes/index.js';
import { connectDB } from './config/db.js';
const app = express();
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://apple-gadgets-ui.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use(router)

export default app;