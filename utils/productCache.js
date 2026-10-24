
import { getRedis } from "../config/redis.js";

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = "apple-gadgets:products:";

export const getProductCache = async (key) => {
  try {
    const redis = await getRedis();
    const value = await redis.get(`${CACHE_PREFIX}${key}`);

    return value === null ? null : JSON.parse(value);
  } catch (error) {
    console.error("Redis cache read error:", error.message);
    return null;
  }
};

export const setProductCache = async (key, data) => {
  try {
    const redis = await getRedis();

    await redis.set(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify(data),
      { EX: CACHE_TTL }
    );
  } catch (error) {
    // Redis fail করলেও API যেন MongoDB থেকে কাজ করতে পারে।
    console.error("Redis cache write error:", error.message);
  }
};

export const clearProductCache = async () => {
  try {
    const redis = await getRedis();
    let cursor = "0";

    do {
      const result = await redis.scan(cursor, {
        MATCH: `${CACHE_PREFIX}*`,
        COUNT: 100,
      });

      cursor = String(result.cursor);

      if (result.keys.length > 0) {
        await redis.del(result.keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    console.error("Redis cache clear error:", error.message);
  }
};
