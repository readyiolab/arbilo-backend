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

// API Endpoints
router.get('/arbitrack',combinedMiddleware, async (req, res) => {
    try {
        const data = await CacheService.getOrSetCache(
            CacheService.CACHE_KEYS.ARBI_TRACK,
            fetchAndProcessData
        );
        res.json(data);
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        res.status(500).json({ error: 'Failed to fetch crypto data' });
    }
});

router.get('/:investment?',combinedMiddleware, async (req, res) => {
    try {
        const investment = parseFloat(req.params.investment) || 100000;

        const data = await CacheService.getOrSetCache(
            CacheService.CACHE_KEYS.ARBI_PAIR,
            fetchArbitrageData
        );

        res.json(data);
    } catch (error) {
        console.error('Error calculating arbitrage opportunities:', error);
        res.status(500).json({ error: 'Failed to calculate arbitrage opportunities' });
    }
});

module.exports = router;
