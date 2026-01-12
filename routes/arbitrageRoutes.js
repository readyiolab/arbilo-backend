const express = require('express');
const CryptoArbitrageService = require('../services/CryptoArbitrageService');
const CryptoPriceFetcher = require('../services/CryptoPriceFetcher');
const CacheService = require('../services/CacheService');

const router = express.Router();
const combinedMiddleware = require('../middleware/userMiddleware');

const priceFetcher = new CryptoPriceFetcher();


// Fetch crypto price data and sort it
const fetchAndProcessData = async () => {
    const coinPriceData = await priceFetcher.fetchPrices();
    const sortedData = Object.entries(coinPriceData)
        .sort(([, a], [, b]) => b.profitPercentage - a.profitPercentage);
    return Object.fromEntries(sortedData);
};

// Fetch arbitrage opportunities
const fetchArbitrageData = async () => {
    const cryptoService = new CryptoArbitrageService();
    return await cryptoService.getArbitrageOpportunities(100000);
};



// 🟢 Start auto-refreshing cache every 5 minutes
CacheService.refreshCachePeriodically(fetchAndProcessData, CacheService.CACHE_KEYS.ARBI_TRACK);
CacheService.refreshCachePeriodically(fetchArbitrageData, CacheService.CACHE_KEYS.ARBI_PAIR);


// Get cache metadata (timestamp info) - for syncing all users
router.get('/cache-info', combinedMiddleware, async (req, res) => {
    try {
        const metadata = await CacheService.getCacheMetadata();
        if (metadata) {
            res.json(metadata);
        } else {
            // If no metadata, create fresh one
            const newMetadata = await CacheService.updateCacheMetadata();
            res.json(newMetadata);
        }
    } catch (error) {
        console.error('Error fetching cache info:', error);
        res.status(500).json({ error: 'Failed to fetch cache info' });
    }
});


router.get('/triangular', async (req, res) => {
    try {
        const data = await CacheService.getOrSetCache(
            CacheService.CACHE_KEYS.TRIANGULAR_ARBI,
            fetchTriangularArbitrageData
        );
        res.json(data);
    } catch (error) {
        console.error('Error fetching triangular arbitrage opportunities:', error);
        res.status(500).json({ error: 'Failed to fetch triangular arbitrage opportunities' });
    }
});

// API Endpoints - FREE FOR ALL AUTHENTICATED USERS
router.get('/arbitrack', combinedMiddleware, async (req, res) => {
    try {
        const data = await CacheService.getOrSetCache(
            CacheService.CACHE_KEYS.ARBI_TRACK,
            fetchAndProcessData
        );
        const metadata = await CacheService.getCacheMetadata();
        
        res.json({
            data,
            cacheInfo: metadata || {
                lastUpdated: new Date().toISOString(),
                lastUpdatedTimestamp: Date.now(),
                nextUpdateAt: new Date(Date.now() + 300000).toISOString(),
                nextUpdateTimestamp: Date.now() + 300000
            }
        });
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        res.status(500).json({ error: 'Failed to fetch crypto data' });
    }
});

// API Endpoints - FREE FOR ALL AUTHENTICATED USERS
router.get('/:investment?', combinedMiddleware, async (req, res) => {
    try {
        const investment = parseFloat(req.params.investment) || 100000;

        const data = await CacheService.getOrSetCache(
            CacheService.CACHE_KEYS.ARBI_PAIR,
            fetchArbitrageData
        );
        const metadata = await CacheService.getCacheMetadata();

        res.json({
            data,
            cacheInfo: metadata || {
                lastUpdated: new Date().toISOString(),
                lastUpdatedTimestamp: Date.now(),
                nextUpdateAt: new Date(Date.now() + 300000).toISOString(),
                nextUpdateTimestamp: Date.now() + 300000
            }
        });
    } catch (error) {
        console.error('Error calculating arbitrage opportunities:', error);
        res.status(500).json({ error: 'Failed to calculate arbitrage opportunities' });
    }
});




module.exports = router;