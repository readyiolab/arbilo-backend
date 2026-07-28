/**
 * Redis client with in-memory fallback.
 * Set REDIS_URL or REDIS_HOST to use real Redis for multi-instance deploys.
 */

const { redisHost, redisPort } = require('./dotenvConfig');

class InMemoryCacheClient {
  constructor() {
    this.cache = new Map();
    this.expiry = new Map();
    console.log('In-memory cache initialized (set REDIS_HOST for shared Redis)');
  }

  async get(key) {
    const now = Date.now();
    const expiryTime = this.expiry.get(key);
    if (expiryTime && now > expiryTime) {
      this.cache.delete(key);
      this.expiry.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }

  async set(key, value) {
    this.cache.set(key, value);
    return 'OK';
  }

  async setEx(key, ttlSeconds, value) {
    this.cache.set(key, value);
    this.expiry.set(key, Date.now() + ttlSeconds * 1000);
    return 'OK';
  }

  async setNX(key, ttlSeconds, value) {
    const existing = await this.get(key);
    if (existing !== null) return null;
    await this.setEx(key, ttlSeconds, value);
    return 'OK';
  }

  async del(key) {
    this.cache.delete(key);
    this.expiry.delete(key);
    return 1;
  }

  async exists(key) {
    return (await this.get(key)) !== null ? 1 : 0;
  }

  async ttl(key) {
    const expiryTime = this.expiry.get(key);
    if (!expiryTime) return -1;
    const ttl = Math.ceil((expiryTime - Date.now()) / 1000);
    return ttl > 0 ? ttl : -2;
  }

  async keys(pattern) {
    if (pattern === '*') return Array.from(this.cache.keys());
    return [];
  }

  async flushAll() {
    this.cache.clear();
    this.expiry.clear();
    return 'OK';
  }
}

async function createClient() {
  const host = redisHost || process.env.REDIS_HOST;
  const port = redisPort || process.env.REDIS_PORT || 6379;
  const url = process.env.REDIS_URL;

  if (!host && !url) {
    return new InMemoryCacheClient();
  }

  try {
    const { createClient } = require('redis');
    const client = url
      ? createClient({ url })
      : createClient({ socket: { host, port: Number(port) } });

    client.on('error', (err) => {
      console.error('Redis error:', err.message);
    });

    await client.connect();
    console.log('Connected to Redis');

    return {
      get: (key) => client.get(key),
      set: (key, value) => client.set(key, value),
      setEx: (key, ttl, value) => client.setEx(key, ttl, value),
      setNX: async (key, ttl, value) => {
        const result = await client.set(key, value, { NX: true, EX: ttl });
        return result;
      },
      del: (key) => client.del(key),
      exists: (key) => client.exists(key),
      ttl: (key) => client.ttl(key),
      keys: (pattern) => client.keys(pattern),
      flushAll: () => client.flushAll(),
      _raw: client,
    };
  } catch (err) {
    console.warn('Redis unavailable, falling back to in-memory cache:', err.message);
    return new InMemoryCacheClient();
  }
}

let cacheClient = new InMemoryCacheClient();
createClient().then((client) => {
  cacheClient = client;
}).catch(() => {});

// Proxy so imports stay sync while Redis connects async
const proxy = new Proxy(
  {},
  {
    get(_target, prop) {
      const value = cacheClient[prop];
      if (typeof value === 'function') {
        return value.bind(cacheClient);
      }
      return value;
    },
  }
);

module.exports = proxy;
