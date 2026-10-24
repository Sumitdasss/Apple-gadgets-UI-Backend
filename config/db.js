
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGO_URI;

const cached =
  globalThis.mongooseConnection ??
  (globalThis.mongooseConnection = {
    conn: null,
    promise: null,
  });

export const connectDB = async () => {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  // Reuse existing connection
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Reuse ongoing connection attempt
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        maxPoolSize: 5,
        minPoolSize: 0,
        maxIdleTimeMS: 10000,
        serverSelectionTimeoutMS: 10000,
      })
      .then((instance) => instance)
      .catch((error) => {
        cached.conn = null;
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.conn = null;
    cached.promise = null;

    console.error("MongoDB connection failed:", error.message);
    throw error;
  }
};

export default connectDB;
