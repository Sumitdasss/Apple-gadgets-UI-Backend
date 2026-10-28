
import { createClient } from "redis";

const OTP_EXPIRY_SECONDS = 5 * 60;
let redisClient;
let connectingPromise;

async function getRedisClient() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is missing");
  }

  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on("error", (error) => {
      console.error("Redis OTP client error:", error);
    });
  }

  if (!redisClient.isOpen) {
    if (!connectingPromise) {
      connectingPromise = redisClient.connect().finally(() => {
        connectingPromise = null;
      });
    }
    await connectingPromise;
  }

  return redisClient;
}

const keyFor = (customerId) => `apple-gadgets:otp:login:${customerId}`;

export async function setLoginOtpTtl(customerId) {
  const client = await getRedisClient();
  await client.set(keyFor(customerId), "active", { EX: OTP_EXPIRY_SECONDS });
}

export async function hasLoginOtpTtl(customerId) {
  const client = await getRedisClient();
  return (await client.exists(keyFor(customerId))) === 1;
}

export async function deleteLoginOtpTtl(customerId) {
  const client = await getRedisClient();
  await client.del(keyFor(customerId));
}
