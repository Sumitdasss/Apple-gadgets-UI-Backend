
import { getRedis } from "../config/redis.js";

const CACHE_PREFIX = "apple-gadgets:categories:";
const CACHE_TTL = 300; // 5 minutes

export const getCategoryCache = async (key) => {
  try {
    const redis = await getRedis();
    const value = await redis.get(`${CACHE_PREFIX}${key}`);

    return value === null ? null : JSON.parse(value);
  } catch (error) {
    console.error("Category cache read error:", error.message);
    return null;
  }
};

export const setCategoryCache = async (key, data) => {
  try {
    const redis = await getRedis();

    await redis.set(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify(data),
      { EX: CACHE_TTL }
    );
  } catch (error) {
    console.error("Category cache write error:", error.message);
  }
};

export const clearCategoryCache = async () => {
  try {
    const redis = await getRedis();
    let cursor = 0;

    do {
      const result = await redis.scan(cursor, {
        MATCH: `${CACHE_PREFIX}*`,
        COUNT: 100,
      });

      cursor = result.cursor;

      if (result.keys.length > 0) {
        await redis.del(result.keys);
      }
    } while (Number(cursor) !== 0);
  } catch (error) {
    console.error("Category cache clear error:", error.message);
  }
};

export const categoryCacheMiddleware = async (req, res, next) => {
  if (req.method !== "GET" || req.headers.authorization) {
    return next();
  }

  const key = req.originalUrl;

  try {
    const cached = await getCategoryCache(key);

    if (cached !== null) {
      res.set("X-Cache", "HIT");

      return res.status(cached.status).json(cached.data);
    }
  } catch (error) {
    console.error("Category cache middleware error:", error.message);
  }

  const originalJson = res.json.bind(res);

  res.json = function (data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void setCategoryCache(key, {
        status: res.statusCode,
        data,
      });
    }

    res.set("X-Cache", "MISS");

    return originalJson(data);
  };

  return next();
};
