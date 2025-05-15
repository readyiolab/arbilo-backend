// const express = require('express');
// const CryptoArbitrageService = require('../services/CryptoArbitrageService');
// const CryptoPriceFetcher = require('../services/CryptoPriceFetcher');
// const CacheService = require('../services/CacheService');
// const router = express.Router();
// const combinedMiddleware = require('../middleware/userMiddleware');

// const priceFetcher = new CryptoPriceFetcher();

// // Fetch crypto price data and sort it
// const fetchAndProcessData = async () => {
//     const coinPriceData = await priceFetcher.fetchPrices();
//     const sortedData = Object.entries(coinPriceData)
//         .sort(([, a], [, b]) => b.profitPercentage - a.profitPercentage);
//     return Object.fromEntries(sortedData);
// };

// // Fetch arbitrage opportunities
// const fetchArbitrageData = async () => {
//     const cryptoService = new CryptoArbitrageService();
//     return await cryptoService.getArbitrageOpportunities(100000);
// };

// // 🟢 Start auto-refreshing cache every 5 minutes
// CacheService.refreshCachePeriodically(fetchAndProcessData, CacheService.CACHE_KEYS.ARBI_TRACK);
// CacheService.refreshCachePeriodically(fetchArbitrageData, CacheService.CACHE_KEYS.ARBI_PAIR);

// // API Endpoints
// router.get('/arbitrack',combinedMiddleware, async (req, res) => {
//     try {
//         const data = await CacheService.getOrSetCache(
//             CacheService.CACHE_KEYS.ARBI_TRACK,
//             fetchAndProcessData
//         );
//         res.json(data);
//     } catch (error) {
//         console.error('Error fetching crypto data:', error);
//         res.status(500).json({ error: 'Failed to fetch crypto data' });
//     }
// });

// router.get('/:investment?',combinedMiddleware, async (req, res) => {
//     try {
//         const investment = parseFloat(req.params.investment) || 100000;

//         const data = await CacheService.getOrSetCache(
//             CacheService.CACHE_KEYS.ARBI_PAIR,
//             fetchArbitrageData
//         );

//         res.json(data);
//     } catch (error) {
//         console.error('Error calculating arbitrage opportunities:', error);
//         res.status(500).json({ error: 'Failed to calculate arbitrage opportunities' });
//     }
// });

// module.exports = router;

// second one
// routes/arbitrageRoutes.js
// const express = require('express');
// const rateLimit = require('express-rate-limit');
// const CryptoArbitrageService = require('../services/CryptoArbitrageService');
// const CryptoPriceFetcher = require('../services/CryptoPriceFetcher');
// const CacheService = require('../services/CacheService');
// const router = express.Router();
// const combinedMiddleware = require('../middleware/userMiddleware');

// const priceFetcher = new CryptoPriceFetcher();

// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000,
//     max: 100,
//     message: 'Too many requests from this IP, please try again later.'
// });

// router.use(limiter);

// const fetchAndProcessData = async () => {
//     const coinPriceData = await priceFetcher.fetchPrices();
//     const sortedData = Object.entries(coinPriceData)
//         .sort(([, a], [, b]) => b.profitPercentage - a.profitPercentage);
//     return Object.fromEntries(sortedData);
// };

// const fetchArbitrageData = async (investment) => {
//     const cryptoService = new CryptoArbitrageService();
//     return await cryptoService.getArbitrageOpportunities(investment);
// };

// CacheService.refreshCachePeriodically(fetchAndProcessData, CacheService.CACHE_KEYS.ARBI_TRACK);
// CacheService.refreshCachePeriodically(() => fetchArbitrageData(100000), CacheService.CACHE_KEYS.ARBI_PAIR);

// router.get('/arbitrack', combinedMiddleware, async (req, res) => {
//     try {
//         const { data, lastRefreshTime, ttl } = await CacheService.getOrSetCache(
//             CacheService.CACHE_KEYS.ARBI_TRACK,
//             fetchAndProcessData
//         );
//         res.json({
//             data,
//             lastRefreshTime,
//             ttl,
//             nextRefreshTime: lastRefreshTime + ttl * 1000,
//             serverTime: Date.now()
//         });
//     } catch (error) {
//         console.error('Error fetching arbittrack data:', error);
//         res.status(500).json({ error: 'Failed to fetch arbittrack data' });
//     }
// });

// router.get('/:investment?', combinedMiddleware, async (req, res) => {
//     try {
//         const investment = parseFloat(req.params.investment) || 100000;
//         const { data, lastRefreshTime, ttl } = await CacheService.getOrSetCache(
//             CacheService.CACHE_KEYS.ARBI_PAIR,
//             () => fetchArbitrageData(investment)
//         );
//         res.json({
//             data,
//             lastRefreshTime,
//             ttl,
//             nextRefreshTime: lastRefreshTime + ttl * 1000,
//             serverTime: Date.now()
//         });
//     } catch (error) {
//         console.error('Error fetching arbitrage data:', error);
//         res.status(500).json({ error: 'Failed to fetch arbitrage data' });
//     }
// });

// module.exports = router;

// backend/routes/arbitrageRoutes.js
const express = require('express');
const rateLimit = require('express-rate-limit');
const CryptoArbitrageService = require('../services/CryptoArbitrageService');
const CryptoPriceFetcher = require('../services/CryptoPriceFetcher');
const CacheService = require('../services/CacheService');
const router = express.Router();
const combinedMiddleware = require('../middleware/userMiddleware');

const priceFetcher = new CryptoPriceFetcher();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});

router.use(limiter);

const fetchAndProcessData = async () => {
    const coinPriceData = await priceFetcher.fetchPrices();
    const sortedData = Object.entries(coinPriceData)
        .sort(([, a], [, b]) => b.profitPercentage - a.profitPercentage);
    return Object.fromEntries(sortedData);
};

const fetchArbitrageData = async (investment) => {
    const cryptoService = new CryptoArbitrageService();
    return await cryptoService.getArbitrageOpportunities(investment);
};

CacheService.refreshCachePeriodically(fetchAndProcessData, CacheService.CACHE_KEYS.ARBI_TRACK);
CacheService.refreshCachePeriodically(() => fetchArbitrageData(100000), CacheService.CACHE_KEYS.ARBI_PAIR);

router.get('/arbitrack', combinedMiddleware, async (req, res) => {
    try {
        const { data, lastRefreshTime, ttl, nextRefreshTime, timeUntilNextRefresh } = await CacheService.getOrSetCache(
            CacheService.CACHE_KEYS.ARBI_TRACK,
            fetchAndProcessData
        );
        res.json({
            data,
            lastRefreshTime,
            ttl,
            nextRefreshTime,
            timeUntilNextRefresh,
            serverTime: Date.now()
        });
    } catch (error) {
        console.error('Error fetching arbittrack data:', error);
        res.status(500).json({ error: 'Failed to fetch arbittrack data' });
    }
});

router.get('/:investment?', combinedMiddleware, async (req, res) => {
    try {
        const investment = parseFloat(req.params.investment) || 100000;
        const { data, lastRefreshTime, ttl, nextRefreshTime, timeUntilNextRefresh } = await CacheService.getOrSetCache(
            CacheService.CACHE_KEYS.ARBI_PAIR,
            () => fetchArbitrageData(investment)
        );
        res.json({
            data,
            lastRefreshTime,
            ttl,
            nextRefreshTime,
            timeUntilNextRefresh,
            serverTime: Date.now()
        });
    } catch (error) {
        console.error('Error fetching arbitrage data:', error);
        res.status(500).json({ error: 'Failed to fetch arbitrage data' });
    }
});

module.exports = router;