const express = require('express');
const CryptoArbitrageService = require('../services/CryptoArbitrageService');
const CacheService = require('../services/CacheService');
const { startBackgroundScans } = require('../services/cacheBootstrap');
const router = express.Router();
const combinedMiddleware = require('../middleware/userMiddleware');

const cryptoService = new CryptoArbitrageService();
const DEFAULT_INVESTMENT = 100000;

startBackgroundScans();

const fetchArbiTrackData = async () => cryptoService.getArbiTrackData();
const fetchArbiPairData = async (investment = DEFAULT_INVESTMENT) =>
  cryptoService.getArbitrageOpportunities(investment);

router.get('/cache-info', combinedMiddleware, async (req, res) => {
    try {
        const metadata = await CacheService.getCacheMetadata();
        if (metadata) {
            res.json(metadata);
        } else {
            const newMetadata = await CacheService.updateCacheMetadata();
            res.json(newMetadata);
        }
    } catch (error) {
        console.error('Error fetching cache info:', error);
        res.status(500).json({ error: 'Failed to fetch cache info' });
    }
});

router.get('/arbitrack', combinedMiddleware, async (req, res) => {
    try {
        const data = await CacheService.getOrSetCache(
            CacheService.CACHE_KEYS.ARBI_TRACK,
            fetchArbiTrackData
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
        console.error('Error fetching ArbiTrack data:', error);
        res.status(500).json({ error: 'Failed to fetch ArbiTrack data' });
    }
});

router.get('/:investment?', combinedMiddleware, async (req, res) => {
    try {
        const investment = parseFloat(req.params.investment) || DEFAULT_INVESTMENT;
        const cacheKey = CacheService.arbipairKey(investment);

        const data = await CacheService.getOrSetCache(
            cacheKey,
            () => fetchArbiPairData(investment)
        );
        const metadata = await CacheService.getCacheMetadata();

        res.json({
            data,
            investment,
            cacheInfo: metadata || {
                lastUpdated: new Date().toISOString(),
                lastUpdatedTimestamp: Date.now(),
                nextUpdateAt: new Date(Date.now() + 300000).toISOString(),
                nextUpdateTimestamp: Date.now() + 300000
            }
        });
    } catch (error) {
        console.error('Error calculating ArbiPair opportunities:', error);
        res.status(500).json({ error: 'Failed to calculate ArbiPair opportunities' });
    }
});

module.exports = router;
