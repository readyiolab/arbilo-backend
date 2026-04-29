const redisClient = require('../config/redisClient');

class CacheService {
    static CACHE_KEYS = {
        ARBI_TRACK: 'arbitrack_data',
        ARBI_PAIR: 'arbipair_data',
        TRIANGULAR_ARBI: 'triangular_arbi',
        SPOT_FUTURES: 'spot_futures_data',
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
            return metadata;
        } catch (error) {
            console.error('Failed to update cache metadata:', error);
            return metadata;
        }
    }

    static async getOrSetCache(key, fetchFunction) {
        try {
            const cachedData = await redisClient.get(key);
            if (cachedData) {
                return JSON.parse(cachedData);
            }

            const freshData = await fetchFunction();
            
            await redisClient.setEx(
                key,
                this.CACHE_TTL,
                JSON.stringify(freshData)
            );

            await this.updateCacheMetadata();

            return freshData;
        } catch (error) {
            console.error(`Cache operation failed for key ${key}:`, error);
            return await fetchFunction();
        }
    }

    /**
     * Master Refresh Logic (Perfect Sync)
     * Refreshes all specified keys in one cycle and updates metadata once.
     * This ensures all users see the exact same timing for all signals.
     */
    static async startMasterRefresh(refreshConfigs) {
        const runRefresh = async () => {
            console.log('🔄 Starting Master Refresh Cycle...');
            try {
                // Fetch all data in parallel
                const results = await Promise.all(
                    refreshConfigs.map(async (config) => {
                        try {
                            const data = await config.fetchFunction();
                            return { key: config.key, data };
                        } catch (err) {
                            console.error(`❌ Failed to fetch data for ${config.key}:`, err.message);
                            return null;
                        }
                    })
                );

                // Store all successful results in Redis
                for (const result of results) {
                    if (result && result.data) {
                        await redisClient.setEx(
                            result.key,
                            this.CACHE_TTL,
                            JSON.stringify(result.data)
                        );
                    }
                }

                // Update metadata ONCE for the entire batch
                const metadata = await this.updateCacheMetadata();
                console.log(`✅ Master Refresh Complete. Next update at: ${metadata.nextUpdateAt}`);
            } catch (error) {
                console.error('❌ Master Refresh Cycle failed:', error);
            }
        };

        // Initial run
        await runRefresh();

        // Set up periodic refresh
        setInterval(runRefresh, this.CACHE_TTL * 1000);
    }

    // 🔄 Auto-refresh cache every 5 minutes (Fallback for single keys)
    static async refreshCachePeriodically(fetchFunction, key) {
        const run = async () => {
            try {
                const freshData = await fetchFunction();
                await redisClient.setEx(key, this.CACHE_TTL, JSON.stringify(freshData));
                await this.updateCacheMetadata();
            } catch (error) {
                console.error(`Failed to refresh cache for key ${key}:`, error);
            }
        };
        await run();
        setInterval(run, this.CACHE_TTL * 1000);
    }
}

module.exports = CacheService;