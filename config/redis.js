
import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
});

redis.on("error", (err) => {
  console.error("Redis error:", err.message);
});

let connectPromise;

export async function getRedis() {
  if (redis.isReady) return redis;

  if (!connectPromise) {
    connectPromise = redis.connect().catch((error) => {
      connectPromise = null;
      throw error;
    });
  }

  await connectPromise;
  return redis;
}
