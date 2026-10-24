
import { getRedis } from "../config/redis.js";

const CACHE_PREFIX = "apple-gadgets:customers:";
const CACHE_TTL = 60; // 60 seconds

export const getCustomerCache = async (key) => {
  try {
    const redis = await getRedis();
    const value = await redis.get(`${CACHE_PREFIX}${key}`);

    return value === null ? null : JSON.parse(value);
  } catch (error) {
    console.error("Customer cache read error:", error.message);
    return null;
  }
};

export const setCustomerCache = async (key, data) => {
  try {
    const redis = await getRedis();

    await redis.set(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify(data),
      { EX: CACHE_TTL }
    );
  } catch (error) {
    console.error("Customer cache write error:", error.message);
  }
};

export const clearCustomerCache = async () => {
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
    console.error("Customer cache clear error:", error.message);
  }
};
