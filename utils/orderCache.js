
import { getRedis } from "../config/redis.js";

const ORDER_CACHE_PREFIX = "apple-gadgets:orders:list:";
const ORDER_CACHE_TTL = 30;

// Read cached order list
export const getOrderListCache = async (key) => {
  try {
    const redis = await getRedis();
    const cached = await redis.get(`${ORDER_CACHE_PREFIX}${key}`);

    if (!cached) return null;

    return JSON.parse(cached);
  } catch (error) {
    console.error("ORDER CACHE READ ERROR:", error.message);
    return null;
  }
};

// Save order list in Redis for 30 seconds
export const setOrderListCache = async (key, data) => {
  try {
    const redis = await getRedis();

    await redis.set(
      `${ORDER_CACHE_PREFIX}${key}`,
      JSON.stringify(data),
      { EX: ORDER_CACHE_TTL },
    );
  } catch (error) {
    console.error("ORDER CACHE WRITE ERROR:", error.message);
  }
};

// Clear all cached order-list pages and filters
export const clearOrderListCache = async () => {
  try {
    const redis = await getRedis();
    let cursor = "0";

    do {
      const result = await redis.scan(cursor, {
        MATCH: `${ORDER_CACHE_PREFIX}*`,
        COUNT: 100,
      });

      cursor = String(result.cursor);

      if (result.keys.length > 0) {
        await redis.del(result.keys);
      }
    } while (cursor !== "0");
  } catch (error) {
    // Cache failure must not fail order creation or updates.
    console.error("ORDER CACHE CLEAR ERROR:", error.message);
  }
};
