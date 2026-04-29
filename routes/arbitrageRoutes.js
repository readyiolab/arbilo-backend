const express = require('express');
const CryptoArbitrageService = require('../services/CryptoArbitrageService');
const CacheService = require('../services/CacheService');
const router = express.Router();
const combinedMiddleware = require('../middleware/userMiddleware');

const cryptoService = new CryptoArbitrageService();

// Fetch functions
const fetchArbiTrackData = async () => {
    return await cryptoService.getArbiTrackData();
};

const fetchArbiPairData = async () => {
    return await cryptoService.getArbitrageOpportunities(100000);
};

// 🟢 PERFECT SYNC: Start Master Refresh Cycle for all signals
// This ensures all users see the exact same timing and results
CacheService.startMasterRefresh([
    { key: CacheService.CACHE_KEYS.ARBI_TRACK, fetchFunction: fetchArbiTrackData },
    { key: CacheService.CACHE_KEYS.ARBI_PAIR, fetchFunction: fetchArbiPairData }
]);

// Get cache metadata (timestamp info) - for syncing all users
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

// ArbiTrack API
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

// ArbiPair API
router.get('/:investment?', combinedMiddleware, async (req, res) => {
    try {
        const investment = parseFloat(req.params.investment) || 100000;
        const data = await CacheService.getOrSetCache(
            CacheService.CACHE_KEYS.ARBI_PAIR,
            fetchArbiPairData
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
        console.error('Error calculating ArbiPair opportunities:', error);
        res.status(500).json({ error: 'Failed to calculate ArbiPair opportunities' });
    }
});

module.exports = router;