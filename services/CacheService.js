const redisClient = require('../config/redisClient');

class CacheService {
    static CACHE_KEYS = {
        ARBI_TRACK: 'arbitrack_data',
        ARBI_PAIR: 'arbipair_data',
        TRIANGULAR_ARBI: 'triangular_arbi',
        CACHE_METADATA: 'cache_metadata'  // Stores last update timestamp
    };
    
    static CACHE_TTL = 300; // 5 minutes in seconds

    // Get current cache metadata (timestamp info)
    static async getCacheMetadata() {
        try {
            const metadata = await redisClient.get(this.CACHE_KEYS.CACHE_METADATA);
            if (metadata) {
                return JSON.parse(metadata);
            }
            return null;
        } catch (error) {
            console.error('Failed to get cache metadata:', error);
            return null;
        }
    }

    // Update cache metadata with new timestamp
    static async updateCacheMetadata() {
        const now = new Date();
        const metadata = {
            lastUpdated: now.toISOString(),
            lastUpdatedTimestamp: now.getTime(),
            nextUpdateAt: new Date(now.getTime() + this.CACHE_TTL * 1000).toISOString(),
            nextUpdateTimestamp: now.getTime() + this.CACHE_TTL * 1000
        };
        
        try {
            await redisClient.setEx(
                this.CACHE_KEYS.CACHE_METADATA,
                this.CACHE_TTL,
                JSON.stringify(metadata)
            );
            console.log('Cache metadata updated:', metadata);
            return metadata;
        } catch (error) {
            console.error('Failed to update cache metadata:', error);
            return metadata;
        }
    }

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

            // Update metadata when new data is cached
            await this.updateCacheMetadata();

            return freshData;
        } catch (error) {
            console.error(`Cache operation failed for key ${key}:`, error);
            return await fetchFunction();
        }
    }

    // 🔄 Auto-refresh cache every 5 minutes
    static async refreshCachePeriodically(fetchFunction, key) {
        // Initial fetch to populate cache on server start
        try {
            console.log(`Initial cache population for key: ${key}`);
            const freshData = await fetchFunction();
            await redisClient.setEx(key, this.CACHE_TTL, JSON.stringify(freshData));
            await this.updateCacheMetadata();
            console.log(`Initial cache populated for key: ${key}`);
        } catch (error) {
            console.error(`Failed to populate initial cache for key ${key}:`, error);
        }

        // Set up periodic refresh
        setInterval(async () => {
            try {
                console.log(`Refreshing cache for key: ${key}`);
                const freshData = await fetchFunction();
                await redisClient.setEx(key, this.CACHE_TTL, JSON.stringify(freshData));
                await this.updateCacheMetadata();
                console.log(`Cache refreshed for key: ${key}`);
            } catch (error) {
                console.error(`Failed to refresh cache for key ${key}:`, error);
            }
        }, this.CACHE_TTL * 1000); // 5 minutes
    }
}

module.exports = CacheService;