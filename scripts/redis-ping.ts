import 'dotenv/config';
import Redis from 'ioredis';

async function main() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redis = new Redis(url);

  try {
    const pong = await redis.ping();
    console.log('REDIS_URL =', url);
    console.log('PING ->', pong);
  } finally {
    await redis.quit();
  }
}

main().catch(async (err) => {
  console.error('Redis ping failed:', err);
  process.exit(1);
});

