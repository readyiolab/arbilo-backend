const express = require('express');
const router = express.Router();
const combinedMiddleware = require('../middleware/userMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const SpotFuturesArbitrageService = require('../services/SpotFuturesArbitrageService');
const CacheService = require('../services/CacheService');
const { calculateProfit } = require('../controllers/spotFuturesController');
const { startBackgroundScans } = require('../services/cacheBootstrap');

const sfService = new SpotFuturesArbitrageService();
const CACHE_KEY_SF = CacheService.CACHE_KEYS.SPOT_FUTURES;

startBackgroundScans();

const fetchSpotFuturesData = async () => {
    return await sfService.scanOpportunities();
};

// ─── User Endpoints ──────────────────────────────────────────────────

/**
 * GET /api/spot-futures/all
 * Combined endpoint: opportunities + funding rates + summary
 * Used by the frontend dashboard
 */
router.get('/all', combinedMiddleware, async (req, res) => {
    try {
        const data = await CacheService.getOrSetCache(CACHE_KEY_SF, fetchSpotFuturesData);
        const metadata = await CacheService.getCacheMetadata();

        res.json({
            success: true,
            opportunities: data.opportunities || [],
            fundingRates: data.fundingRates || [],
            summary: data.summary || {},
            lastUpdated: data.lastUpdated,
            cacheInfo: metadata || {
                lastUpdated: new Date().toISOString(),
                lastUpdatedTimestamp: Date.now(),
                nextUpdateAt: new Date(Date.now() + 300000).toISOString(),
                nextUpdateTimestamp: Date.now() + 300000
            }
        });
    } catch (error) {
        console.error('Error fetching spot-futures data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch data' });
    }
});

/**
 * GET /api/spot-futures/opportunities
 * Just the arbitrage opportunities
 */
router.get('/opportunities', combinedMiddleware, async (req, res) => {
    try {
        const data = await CacheService.getOrSetCache(CACHE_KEY_SF, fetchSpotFuturesData);
        const metadata = await CacheService.getCacheMetadata();

        res.json({
            success: true,
            data: data.opportunities || [],
            summary: data.summary || {},
            lastUpdated: data.lastUpdated,
            cacheInfo: metadata || {
                lastUpdated: new Date().toISOString(),
                lastUpdatedTimestamp: Date.now(),
                nextUpdateAt: new Date(Date.now() + 300000).toISOString(),
                nextUpdateTimestamp: Date.now() + 300000
            }
        });
    } catch (error) {
        console.error('Error fetching opportunities:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch opportunities' });
    }
});

/**
 * GET /api/spot-futures/funding-rates
 * Just the funding rates
 */
router.get('/funding-rates', combinedMiddleware, async (req, res) => {
    try {
        const data = await CacheService.getOrSetCache(CACHE_KEY_SF, fetchSpotFuturesData);

        res.json({
            success: true,
            data: data.fundingRates || [],
            lastUpdated: data.lastUpdated,
        });
    } catch (error) {
        console.error('Error fetching funding rates:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch funding rates' });
    }
});

/**
 * POST /api/spot-futures/calculate
 * Calculate net profit for a custom scenario
 */
router.post('/calculate', combinedMiddleware, calculateProfit);

// ─── Admin Endpoints ────────────────────────────────────────────────

/**
 * GET /api/spot-futures/admin/summary
 * Detailed summary for admin dashboard
 */
router.get('/admin/summary', adminMiddleware, async (req, res) => {
    try {
        const data = await CacheService.getOrSetCache(CACHE_KEY_SF, fetchSpotFuturesData);
        const metadata = await CacheService.getCacheMetadata();

        res.json({
            success: true,
            summary: data.summary || {},
            totalOpportunities: (data.opportunities || []).length,
            totalFundingRates: (data.fundingRates || []).length,
            profitableOpportunities: (data.opportunities || []).filter(o => o.netProfitPct > 0).length,
            highRiskCount: (data.opportunities || []).filter(o => o.riskLevel === 'high').length,
            cacheInfo: metadata,
            lastUpdated: data.lastUpdated,
        });
    } catch (error) {
        console.error('Error fetching admin summary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch admin summary' });
    }
});

/**
 * GET /api/spot-futures/admin/all
 * Full data for admin (same as user but no auth constraint - uses admin middleware)
 */
router.get('/admin/all', adminMiddleware, async (req, res) => {
    try {
        const data = await CacheService.getOrSetCache(CACHE_KEY_SF, fetchSpotFuturesData);
        const metadata = await CacheService.getCacheMetadata();

        res.json({
            success: true,
            opportunities: data.opportunities || [],
            fundingRates: data.fundingRates || [],
            summary: data.summary || {},
            lastUpdated: data.lastUpdated,
            cacheInfo: metadata,
        });
    } catch (error) {
        console.error('Error fetching admin data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch admin data' });
    }
});

module.exports = router;
