/**
 * In-Memory Cache Client
 * This provides a Redis-like interface for caching data in memory
 * All users will see the same cached data with consistent timestamps
 */

class InMemoryCacheClient {
    constructor() {
        this.cache = new Map();
        this.expiry = new Map();
        console.log('✅ In-Memory Cache initialized');
    }

    async get(key) {
        const now = Date.now();
        const expiryTime = this.expiry.get(key);
        
        // Check if key has expired
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
        this.expiry.set(key, Date.now() + (ttlSeconds * 1000));
        return 'OK';
    }

    async del(key) {
        this.cache.delete(key);
        this.expiry.delete(key);
        return 1;
    }

    async exists(key) {
        const now = Date.now();
        const expiryTime = this.expiry.get(key);
        
        if (expiryTime && now > expiryTime) {
            this.cache.delete(key);
            this.expiry.delete(key);
            return 0;
        }
        
        return this.cache.has(key) ? 1 : 0;
    }

    async ttl(key) {
        const expiryTime = this.expiry.get(key);
        if (!expiryTime) return -1;
        
        const ttl = Math.ceil((expiryTime - Date.now()) / 1000);
        return ttl > 0 ? ttl : -2;
    }

    async keys(pattern) {
        // Simple pattern matching for "*" only
        if (pattern === '*') {
            return Array.from(this.cache.keys());
        }
        return [];
    }

    async flushAll() {
        this.cache.clear();
        this.expiry.clear();
        return 'OK';
    }
}

const cacheClient = new InMemoryCacheClient();

module.exports = cacheClient;