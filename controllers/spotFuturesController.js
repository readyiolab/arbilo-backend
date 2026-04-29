const SpotFuturesArbitrageService = require('../services/SpotFuturesArbitrageService');

const sfService = new SpotFuturesArbitrageService();

/**
 * GET /api/spot-futures/opportunities
 * Returns all spot-futures arbitrage opportunities (user-facing)
 */
const getOpportunities = async (req, res) => {
    try {
        // Data comes from cache (set up in routes), this is the fallback
        const data = await sfService.scanOpportunities();
        res.json({
            success: true,
            data: data.opportunities,
            summary: data.summary,
            lastUpdated: data.lastUpdated,
        });
    } catch (error) {
        console.error('Error fetching spot-futures opportunities:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch opportunities' });
    }
};

/**
 * GET /api/spot-futures/funding-rates
 * Returns current funding rates across exchanges (user-facing)
 */
const getFundingRates = async (req, res) => {
    try {
        const data = await sfService.scanOpportunities();
        res.json({
            success: true,
            data: data.fundingRates,
            lastUpdated: data.lastUpdated,
        });
    } catch (error) {
        console.error('Error fetching funding rates:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch funding rates' });
    }
};

/**
 * POST /api/spot-futures/calculate
 * Calculate net profit for a custom scenario (user-facing)
 * Body: { spotPrice, futuresPrice, fundingRate, exchange, investment, daysHeld }
 */
const calculateProfit = async (req, res) => {
    try {
        const {
            spotPrice,
            futuresPrice,
            fundingRate = 0.01,
            exchange = 'binance',
            investment = 10000,
            daysHeld = 7
        } = req.body;

        if (!spotPrice || !futuresPrice) {
            return res.status(400).json({
                success: false,
                message: 'spotPrice and futuresPrice are required'
            });
        }

        const result = sfService.calculateCustomProfit(
            parseFloat(spotPrice),
            parseFloat(futuresPrice),
            parseFloat(fundingRate),
            exchange,
            parseFloat(investment),
            parseInt(daysHeld)
        );

        res.json({
            success: true,
            data: {
                ...result,
                input: { spotPrice, futuresPrice, fundingRate, exchange, investment, daysHeld }
            }
        });
    } catch (error) {
        console.error('Error calculating profit:', error);
        res.status(500).json({ success: false, message: 'Failed to calculate profit' });
    }
};

/**
 * GET /api/spot-futures/summary
 * Returns summary stats for admin dashboard
 */
const getSummary = async (req, res) => {
    try {
        const data = await sfService.scanOpportunities();
        res.json({
            success: true,
            data: data.summary,
            lastUpdated: data.lastUpdated,
        });
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch summary' });
    }
};

/**
 * GET /api/spot-futures/all
 * Returns everything: opportunities + funding rates + summary (combined for dashboard)
 */
const getAllData = async (req, res) => {
    try {
        const data = await sfService.scanOpportunities();
        res.json({
            success: true,
            opportunities: data.opportunities,
            fundingRates: data.fundingRates,
            summary: data.summary,
            lastUpdated: data.lastUpdated,
        });
    } catch (error) {
        console.error('Error fetching all spot-futures data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch data' });
    }
};

module.exports = {
    getOpportunities,
    getFundingRates,
    calculateProfit,
    getSummary,
    getAllData,
};
