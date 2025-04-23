const redisClient = require('../config/redisClient');

class CacheService {
    static CACHE_KEYS = {
        ARBI_TRACK: 'arbitrack_data',
        ARBI_PAIR: 'arbipair_data',
        SENTIMENT_ALL: 'sentiment_all_data',
        SENTIMENT_COIN: 'sentiment_coin' // Will be used with suffix: sentiment_coin_BTC, etc.
    };
    
    static CACHE_TTL = 300; // 5 minutes in seconds

    static async getOrSetCache(key, fetchFunction) {
        try {
            // Try to get data from cache
            const cachedData = await redisClient.get(key);
            if (cachedData) {
                return JSON.parse(cachedData);
            }

            // If no cached data, fetch fresh data
            const freshData = await fetchFunction();
            
            // Store in cache with TTL
            await redisClient.setEx(
                key,
                this.CACHE_TTL,
                JSON.stringify(freshData)
            );

            return freshData;
        } catch (error) {
            console.error(`Cache operation failed for key ${key}:`, error);
            return await fetchFunction();
        }
    }

    // 🔄 Auto-refresh cache every 5 minutes
    static async refreshCachePeriodically(fetchFunction, key) {
        setInterval(async () => {
            try {
                console.log(`Refreshing cache for key: ${key}`);
                const freshData = await fetchFunction();
                await redisClient.setEx(key, this.CACHE_TTL, JSON.stringify(freshData));
                console.log(`Cache refreshed for key: ${key}`);
            } catch (error) {
                console.error(`Failed to refresh cache for key ${key}:`, error);
            }
        }, this.CACHE_TTL * 1000); // 5 minutes
    }
}

module.exports = CacheService;