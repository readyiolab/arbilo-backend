const redisClient = require('../config/redisClient');
const WebSocket = require('ws');

class CacheService {
  static CACHE_KEYS = {
    ARBI_TRACK: 'arbitrack_data',
    ARBI_PAIR: 'arbipair_data',
  };

  static CACHE_TTL = 300; // 5 minutes in seconds
  static inMemoryCache = new Map(); // Fallback cache

  static initializeWebSocket(wss) {
    this.wss = wss;
  }

  static broadcast(key, data, lastRefreshTime) {
    if (!this.wss) {
      console.warn('WebSocket server not initialized for broadcast');
      return;
    }
    const nextRefreshTime = lastRefreshTime + this.CACHE_TTL * 1000;
    const timeUntilNextRefresh = Math.max(0, Math.floor((nextRefreshTime - Date.now()) / 1000));
    const message = JSON.stringify({
      key,
      data,
      lastRefreshTime,
      ttl: this.CACHE_TTL,
      nextRefreshTime,
      timeUntilNextRefresh,
      serverTime: Date.now(),
    });

    let clientCount = 0;
    let errorCount = 0;
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
          clientCount++;
        } catch (err) {
          console.error('Error sending WebSocket message to client:', err);
          errorCount++;
        }
      }
    });
    console.log(`Broadcasted ${key} to ${clientCount} clients, ${errorCount} errors`);
  }

  static async retryRedisOperation(operation, maxRetries = 3, delay = 100) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`Redis operation failed, attempt ${attempt}/${maxRetries}:`, error.message);
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
      }
    }
    throw lastError;
  }

  static async getOrSetCache(key, fetchFunction) {
    try {
      // Try Redis first
      const [cachedData, lastRefreshTime, nextRefreshTime] = await this.retryRedisOperation(() =>
        Promise.all([
          redisClient.get(key),
          redisClient.get(`${key}:last_refresh`),
          redisClient.get(`${key}:next_refresh`),
        ])
      );
      const ttl = await this.retryRedisOperation(() => redisClient.ttl(key));

      if (cachedData && lastRefreshTime && nextRefreshTime) {
        const serverTime = Date.now();
        const timeUntilNextRefresh = Math.max(0, Math.floor((parseInt(nextRefreshTime) - serverTime) / 1000));
        return {
          data: JSON.parse(cachedData),
          lastRefreshTime: parseInt(lastRefreshTime),
          ttl: ttl > 0 ? ttl : this.CACHE_TTL,
          nextRefreshTime: parseInt(nextRefreshTime),
          timeUntilNextRefresh,
        };
      }
    } catch (error) {
      console.error(`Redis cache operation failed for key ${key}:`, error);
      // Check in-memory cache
      const cached = this.inMemoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        const { data, lastRefreshTime, nextRefreshTime } = cached;
        const timeUntilNextRefresh = Math.max(0, Math.floor((nextRefreshTime - Date.now()) / 1000));
        return {
          data,
          lastRefreshTime,
          ttl: this.CACHE_TTL,
          nextRefreshTime,
          timeUntilNextRefresh,
        };
      }
    }

    // Fetch fresh data
    try {
      const freshData = await fetchFunction();
      const timestamp = Date.now();
      const nextRefreshTimestamp = timestamp + this.CACHE_TTL * 1000;
      const timeUntilNextRefresh = this.CACHE_TTL;

      // Store in Redis if available
      try {
        await this.retryRedisOperation(() =>
          Promise.all([
            redisClient.setEx(key, this.CACHE_TTL, JSON.stringify(freshData)),
            redisClient.setEx(`${key}:last_refresh`, this.CACHE_TTL, timestamp.toString()),
            redisClient.setEx(`${key}:next_refresh`, this.CACHE_TTL, nextRefreshTimestamp.toString()),
          ])
        );
      } catch (redisError) {
        console.error(`Failed to store in Redis for key ${key}:`, redisError);
        // Store in in-memory cache
        this.inMemoryCache.set(key, {
          data: freshData,
          lastRefreshTime: timestamp,
          nextRefreshTime: nextRefreshTimestamp,
          expires: nextRefreshTimestamp,
        });
      }

      this.broadcast(key, freshData, timestamp);

      return {
        data: freshData,
        lastRefreshTime: timestamp,
        ttl: this.CACHE_TTL,
        nextRefreshTime: nextRefreshTimestamp,
        timeUntilNextRefresh,
      };
    } catch (error) {
      console.error(`Data fetch failed for key ${key}:`, error);
      throw error;
    }
  }

  static async refreshCachePeriodically(fetchFunction, key) {
    const refresh = async () => {
      try {
        const freshData = await fetchFunction();
        const timestamp = Date.now();
        const nextRefreshTimestamp = timestamp + this.CACHE_TTL * 1000;

        // Store in Redis if available
        try {
          await this.retryRedisOperation(() =>
            Promise.all([
              redisClient.setEx(key, this.CACHE_TTL, JSON.stringify(freshData)),
              redisClient.setEx(`${key}:last_refresh`, this.CACHE_TTL, timestamp.toString()),
              redisClient.setEx(`${key}:next_refresh`, this.CACHE_TTL, nextRefreshTimestamp.toString()),
            ])
          );
        } catch (redisError) {
          console.error(`Failed to refresh Redis cache for key ${key}:`, redisError);
          // Store in in-memory cache
          this.inMemoryCache.set(key, {
            data: freshData,
            lastRefreshTime: timestamp,
            nextRefreshTime: nextRefreshTimestamp,
            expires: nextRefreshTimestamp,
          });
        }

        console.log(`Cache refreshed for key: ${key} at ${new Date(timestamp).toISOString()}`);
        this.broadcast(key, freshData, timestamp);
      } catch (error) {
        console.error(`Failed to refresh cache for key ${key}:`, error);
      }
    };

    await refresh();
    setInterval(refresh, this.CACHE_TTL * 1000);
  }
}

module.exports = CacheService;
// backend/services/CacheService.js
// const redisClient = require('../config/redisClient');

// class CacheService {
//     static CACHE_KEYS = {
//         ARBI_TRACK: 'arbitrack_data',
//         ARBI_PAIR: 'arbipair_data'
//     };

//     static CACHE_TTL = 300; // 5 minutes in seconds

//     static initializeWebSocket(wss) {
//         this.wss = wss;
//     }

//     static broadcast(key, data, lastRefreshTime) {
//         if (!this.wss) return;
//         const nextRefreshTime = lastRefreshTime + this.CACHE_TTL * 1000;
//         const timeUntilNextRefresh = Math.max(0, Math.floor((nextRefreshTime - Date.now()) / 1000));
//         const message = JSON.stringify({
//             key,
//             data,
//             lastRefreshTime,
//             ttl: this.CACHE_TTL,
//             nextRefreshTime,
//             timeUntilNextRefresh,
//             serverTime: Date.now()
//         });
//         this.wss.clients.forEach(client => {
//             if (client.readyState === 1) {
//                 client.send(message);
//             }
//         });
//     }

//     static async getOrSetCache(key, fetchFunction) {
//         try {
//             const [cachedData, lastRefreshTime, nextRefreshTime] = await Promise.all([
//                 redisClient.get(key),
//                 redisClient.get(`${key}:last_refresh`),
//                 redisClient.get(`${key}:next_refresh`)
//             ]);
//             const ttl = await redisClient.ttl(key);

//             if (cachedData && lastRefreshTime && nextRefreshTime) {
//                 const serverTime = Date.now();
//                 const timeUntilNextRefresh = Math.max(0, Math.floor((parseInt(nextRefreshTime) - serverTime) / 1000));
//                 return {
//                     data: JSON.parse(cachedData),
//                     lastRefreshTime: parseInt(lastRefreshTime),
//                     ttl: ttl > 0 ? ttl : this.CACHE_TTL,
//                     nextRefreshTime: parseInt(nextRefreshTime),
//                     timeUntilNextRefresh
//                 };
//             }

//             const freshData = await fetchFunction();
//             const timestamp = Date.now();
//             const nextRefreshTimestamp = timestamp + this.CACHE_TTL * 1000;
//             const timeUntilNextRefresh = this.CACHE_TTL;

//             await Promise.all([
//                 redisClient.setEx(key, this.CACHE_TTL, JSON.stringify(freshData)),
//                 redisClient.setEx(`${key}:last_refresh`, this.CACHE_TTL, timestamp.toString()),
//                 redisClient.setEx(`${key}:next_refresh`, this.CACHE_TTL, nextRefreshTimestamp.toString())
//             ]);

//             this.broadcast(key, freshData, timestamp);

//             return {
//                 data: freshData,
//                 lastRefreshTime: timestamp,
//                 ttl: this.CACHE_TTL,
//                 nextRefreshTime: nextRefreshTimestamp,
//                 timeUntilNextRefresh
//             };
//         } catch (error) {
//             console.error(`Cache operation failed for key ${key}:`, error);
//             const freshData = await fetchFunction();
//             const timestamp = Date.now();
//             const nextRefreshTimestamp = timestamp + this.CACHE_TTL * 1000;
//             return {
//                 data: freshData,
//                 lastRefreshTime: timestamp,
//                 ttl: this.CACHE_TTL,
//                 nextRefreshTime: nextRefreshTimestamp,
//                 timeUntilNextRefresh: this.CACHE_TTL
//             };
//         }
//     }

//     static async refreshCachePeriodically(fetchFunction, key) {
//         const refresh = async () => {
//             try {
//                 const freshData = await fetchFunction();
//                 const timestamp = Date.now();
//                 const nextRefreshTimestamp = timestamp + this.CACHE_TTL * 1000;
//                 await Promise.all([
//                     redisClient.setEx(key, this.CACHE_TTL, JSON.stringify(freshData)),
//                     redisClient.setEx(`${key}:last_refresh`, this.CACHE_TTL, timestamp.toString()),
//                     redisClient.setEx(`${key}:next_refresh`, this.CACHE_TTL, nextRefreshTimestamp.toString())
//                 ]);
//                 console.log(`Cache refreshed for key: ${key} at ${new Date(timestamp).toISOString()}`);
//                 this.broadcast(key, freshData, timestamp);
//             } catch (error) {
//                 console.error(`Failed to refresh cache for key ${key}:`, error);
//             }
//         };

//         await refresh();
//         setInterval(refresh, this.CACHE_TTL * 1000);
//     }
// }

// module.exports = CacheService;