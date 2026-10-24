
import "dotenv/config";
import { getRedis } from "./config/redis.js";

try {
  const redis = await getRedis();

  await redis.set("apple-gadgets:test", "connected", {
    EX: 60,
  });

  const result = await redis.get("apple-gadgets:test");

  console.log("Redis test result:", result);
} catch (error) {
  console.error("Redis connection failed:", error.message);
  process.exitCode = 1;
}
