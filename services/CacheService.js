const redisClient = require('../config/redisClient');

class CacheService {
    static CACHE_KEYS = {
        ARBI_TRACK: 'arbitrack_data',
        ARBI_PAIR: 'arbipair_data',
        TRIANGULAR_ARBI: 'triangular_arbi',
        SPOT_FUTURES: 'spot_futures_data',
        CACHE_METADATA: 'cache_metadata'
    };
    
    static CACHE_TTL = 300; // 5 minutes
    static _refreshing = new Set();
    static _masterStarted = false;

    static arbipairKey(investment = 100000) {
        return `${this.CACHE_KEYS.ARBI_PAIR}:${investment}`;
    }

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

            // Stampede lock: only one refresh per key at a time
            const lockKey = `lock:${key}`;
            if (this._refreshing.has(key)) {
                // Wait briefly for in-flight refresh
                await new Promise((r) => setTimeout(r, 500));
                const retry = await redisClient.get(key);
                if (retry) return JSON.parse(retry);
            }

            this._refreshing.add(key);
            try {
                if (typeof redisClient.setNX === 'function') {
                    await redisClient.setNX(lockKey, 30, '1');
                }

                const freshData = await fetchFunction();
                await redisClient.setEx(key, this.CACHE_TTL, JSON.stringify(freshData));
                await this.updateCacheMetadata();
                return freshData;
            } finally {
                this._refreshing.delete(key);
                try {
                    await redisClient.del(lockKey);
                } catch (_) {}
            }
        } catch (error) {
            console.error(`Cache operation failed for key ${key}:`, error);
            return await fetchFunction();
        }
    }

    static async startMasterRefresh(refreshConfigs) {
        if (this._masterStarted) {
            console.log('Master refresh already started, skipping duplicate');
            return;
        }
        this._masterStarted = true;

        const runRefresh = async () => {
            console.log('Starting Master Refresh Cycle...');
            try {
                const results = await Promise.all(
                    refreshConfigs.map(async (config) => {
                        try {
                            const data = await config.fetchFunction();
                            return { key: config.key, data };
                        } catch (err) {
                            console.error(`Failed to fetch data for ${config.key}:`, err.message);
                            return null;
                        }
                    })
                );

                for (const result of results) {
                    if (result && result.data) {
                        await redisClient.setEx(
                            result.key,
                            this.CACHE_TTL,
                            JSON.stringify(result.data)
                        );
                    }
                }

                const metadata = await this.updateCacheMetadata();
                console.log(`Master Refresh Complete. Next update at: ${metadata.nextUpdateAt}`);
            } catch (error) {
                console.error('Master Refresh Cycle failed:', error);
            }
        };

        await runRefresh();
        setInterval(runRefresh, this.CACHE_TTL * 1000);
    }

    static async refreshCachePeriodically(fetchFunction, key) {
        // Prefer master refresh; keep as fallback for keys not in master
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
