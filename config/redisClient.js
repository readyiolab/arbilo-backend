const redis = require('redis');
const { redisHost, redisPort } = require('./dotenvConfig');

// Constants
const MAX_RETRIES = 20;
const MAX_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY = 100;
const MAX_RECONNECT_DELAY = 3000;
const CONNECTION_RETRY_DELAY = 2000;

const redisClient = redis.createClient({
  socket: {
    host: redisHost || '127.0.0.1',
    port: redisPort || 6379,
    reconnectStrategy: (retries) => {
      if (retries > MAX_RETRIES) {
        console.error('Max Redis reconnect attempts reached');
        return new Error('Max reconnect attempts reached');
      }
      const delay = Math.min(retries * RECONNECT_BASE_DELAY, MAX_RECONNECT_DELAY);
      console.log(`Retrying Redis connection, attempt ${retries}, delay ${delay}ms`);
      return delay;
    },
  },
  maxRetriesPerRequest: 10,
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redisClient.on('error', (error) => {
  console.error('❌ Redis Connection Error:', error);
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Reconnecting to Redis...');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

redisClient.on('end', () => {
  console.log('❌ Redis connection closed');
});

const connectWithRetry = async () => {
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    try {
      await redisClient.connect();
      console.log('✅ Redis connection established');
      return;
    } catch (err) {
      console.error(`❌ Redis connection attempt ${attempts + 1} failed:`, err);
      attempts++;
      if (attempts === MAX_ATTEMPTS) {
        console.error('❌ Max Redis connection attempts reached. Falling back to in-memory cache.');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, CONNECTION_RETRY_DELAY));
    }
  }
};

connectWithRetry();

module.exports = redisClient;