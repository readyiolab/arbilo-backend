const ccxt = require('ccxt');

class SpotFuturesArbitrageService {
    constructor() {
        // Exchanges that support both spot AND futures
        this.exchangeConfigs = [
            { name: 'binance', spotType: 'spot', futuresType: 'future' },
            { name: 'bybit', spotType: 'spot', futuresType: 'linear' },
            { name: 'okx', spotType: 'spot', futuresType: 'swap' },
        ];

        this.symbols = [
            'BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX',
            'LINK', 'DOT', 'MATIC', 'LTC', 'BCH', 'UNI', 'ATOM',
            'FIL', 'NEAR', 'ARB', 'OP', 'APT', 'SUI'
        ];

        this.MAX_RETRIES = 2;
        this.RETRY_DELAY = 500;
        this.exchanges = {};
        this.initPromises = {}; // Track pending initialization promises
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async initializeExchange(exchangeName, type) {
        const key = `${exchangeName}_${type}`;

        // If already fully initialized, return it
        if (this.exchanges[key]) {
            return this.exchanges[key];
        }

        // If initialization is in progress, wait for it (prevents race condition)
        if (this.initPromises[key]) {
            return this.initPromises[key];
        }

        // Start initialization and store the promise so concurrent callers wait
        this.initPromises[key] = (async () => {
            try {
                const config = {
                    enableRateLimit: true,
                    timeout: 15000,
                };

                if (type !== 'spot') {
                    config.options = { defaultType: type };
                }

                const exchange = new ccxt[exchangeName](config);
                await exchange.loadMarkets();
                this.exchanges[key] = exchange;
                console.log(`✅ Initialized ${exchangeName} (${type})`);
                return exchange;
            } catch (err) {
                console.warn(`⚠️ Failed to init ${exchangeName} (${type}): ${err.message}`);
                return null;
            } finally {
                delete this.initPromises[key];
            }
        })();

        return this.initPromises[key];
    }

    async fetchWithRetry(fn, retries = 0) {
        try {
            return await fn();
        } catch (error) {
            if (retries < this.MAX_RETRIES) {
                await this.delay(this.RETRY_DELAY * (retries + 1));
                return this.fetchWithRetry(fn, retries + 1);
            }
            throw error;
        }
    }

    /**
     * Fetch spot price for a symbol on a given exchange
     */
    async fetchSpotPrice(exchangeName, symbol) {
        const exchange = await this.initializeExchange(exchangeName, 'spot');
        if (!exchange) return null;

        const pair = `${symbol}/USDT`;
        if (!exchange.markets[pair]) return null;

        try {
            const ticker = await this.fetchWithRetry(() => exchange.fetchTicker(pair));
            return {
                price: ticker.last,
                bid: ticker.bid || ticker.last,
                ask: ticker.ask || ticker.last,
                volume: ticker.quoteVolume || (ticker.baseVolume * ticker.last) || 0,
                timestamp: Date.now()
            };
        } catch (err) {
            console.warn(`❌ Spot ${exchangeName} ${symbol}: ${err.message}`);
            return null;
        }
    }

    /**
     * Fetch futures price for a symbol on a given exchange
     */
    async fetchFuturesPrice(exchangeName, futuresType, symbol) {
        const exchange = await this.initializeExchange(exchangeName, futuresType);
        if (!exchange) return null;

        // Different exchanges use different futures pair formats
        const possiblePairs = [
            `${symbol}/USDT:USDT`,
            `${symbol}/USDT`,
        ];

        let pair = null;
        for (const p of possiblePairs) {
            if (exchange.markets[p]) {
                pair = p;
                break;
            }
        }

        if (!pair) return null;

        try {
            const ticker = await this.fetchWithRetry(() => exchange.fetchTicker(pair));
            return {
                price: ticker.last,
                bid: ticker.bid || ticker.last,
                ask: ticker.ask || ticker.last,
                volume: ticker.quoteVolume || (ticker.baseVolume * ticker.last) || 0,
                pair: pair,
                timestamp: Date.now()
            };
        } catch (err) {
            console.warn(`❌ Futures ${exchangeName} ${symbol}: ${err.message}`);
            return null;
        }
    }

    /**
     * Fetch funding rate for a futures symbol
     */
    async fetchFundingRate(exchangeName, futuresType, symbol) {
        const exchange = await this.initializeExchange(exchangeName, futuresType);
        if (!exchange) return null;

        const possiblePairs = [
            `${symbol}/USDT:USDT`,
            `${symbol}/USDT`,
        ];

        let pair = null;
        for (const p of possiblePairs) {
            if (exchange.markets[p]) {
                pair = p;
                break;
            }
        }

        if (!pair) return null;

        try {
            const fundingRate = await this.fetchWithRetry(() => exchange.fetchFundingRate(pair));
            return {
                symbol: symbol,
                fundingRate: fundingRate.fundingRate || 0,
                fundingTimestamp: fundingRate.fundingDatetime || fundingRate.timestamp || null,
                nextFundingTimestamp: fundingRate.nextFundingDatetime || fundingRate.nextFundingTimestamp || null,
                markPrice: fundingRate.markPrice || null,
                indexPrice: fundingRate.indexPrice || null,
            };
        } catch (err) {
            console.warn(`⚠️ Funding rate ${exchangeName} ${symbol}: ${err.message}`);
            return null;
        }
    }

    /**
     * Calculate fees for a trade
     */
    calculateFees(exchangeName) {
        const feeStructure = {
            'binance': { spotMaker: 0.001, spotTaker: 0.001, futuresMaker: 0.0002, futuresTaker: 0.0005 },
            'bybit': { spotMaker: 0.001, spotTaker: 0.001, futuresMaker: 0.0002, futuresTaker: 0.00055 },
            'okx': { spotMaker: 0.0008, spotTaker: 0.001, futuresMaker: 0.0002, futuresTaker: 0.0005 },
        };
        return feeStructure[exchangeName] || { spotMaker: 0.001, spotTaker: 0.001, futuresMaker: 0.0005, futuresTaker: 0.0005 };
    }

    /**
     * Calculate net profit for a spot-futures arbitrage opportunity
     */
    calculateNetProfit(spotPrice, futuresPrice, fundingRate, exchangeName, investmentUSD = 10000, daysHeld = 7) {
        const fees = this.calculateFees(exchangeName);

        // Raw spread (positive = contango/futures premium, negative = backwardation/futures discount)
        const spreadPct = ((futuresPrice - spotPrice) / spotPrice) * 100;

        // Total fees (open + close both positions)
        const totalFeesPct = ((fees.spotTaker + fees.futuresTaker) * 2) * 100;

        // Raw funding rate info (market-relative, not strategy-adjusted)
        const fundingCycles = daysHeld * 3;
        const dailyFundingPct = (fundingRate || 0) * 3 * 100;
        const totalFundingPct = (fundingRate || 0) * fundingCycles * 100;

        // Strategy-adjusted gross profit based on trade direction
        const isContango = spreadPct >= 0;
        let grossProfitPct;

        if (isContango) {
            // Strategy: Buy Spot + Short Futures
            // Spread earned = spreadPct (positive, the futures premium)
            // Funding: shorts receive when rate > 0, pay when rate < 0
            grossProfitPct = spreadPct + totalFundingPct;
        } else {
            // Strategy: Short Spot + Buy Futures
            // Spread earned = -spreadPct (flip the negative spread to positive gain)
            // Funding: longs pay when rate > 0, receive when rate < 0 (opposite of shorts)
            grossProfitPct = -spreadPct + (-totalFundingPct);
        }

        const netProfitPct = grossProfitPct - totalFeesPct;
        const netProfitUSD = investmentUSD * (netProfitPct / 100);

        return {
            spreadPct: Number(spreadPct.toFixed(4)),
            totalFeesPct: Number(totalFeesPct.toFixed(4)),
            dailyFundingPct: Number(dailyFundingPct.toFixed(4)),
            totalFundingPct: Number(totalFundingPct.toFixed(4)),
            grossProfitPct: Number(grossProfitPct.toFixed(4)),
            netProfitPct: Number(netProfitPct.toFixed(4)),
            netProfitUSD: Number(netProfitUSD.toFixed(2)),
        };
    }

    /**
     * Assess risk level for a given opportunity
     */
    assessRisk(opportunity) {
        const risks = [];
        let riskLevel = 'low';

        // Direction-aware funding rate risk
        const isContango = opportunity.spreadPct >= 0;

        if (isContango && opportunity.fundingRate < 0) {
            // Buy Spot + Short Futures: negative funding = shorts pay
            risks.push('Negative funding rate - you pay fees when shorting');
            riskLevel = 'high';
        } else if (!isContango && opportunity.fundingRate > 0) {
            // Short Spot + Buy Futures: positive funding = longs pay
            risks.push('Positive funding rate - you pay fees when long');
            riskLevel = 'high';
        }

        if (opportunity.spotVolume < 500000) {
            risks.push('Low spot liquidity - slippage risk');
            riskLevel = riskLevel === 'high' ? 'high' : 'medium';
        }

        if (opportunity.futuresVolume < 500000) {
            risks.push('Low futures liquidity - slippage risk');
            riskLevel = riskLevel === 'high' ? 'high' : 'medium';
        }

        if (Math.abs(opportunity.spreadPct) > 5) {
            risks.push('Unusually large spread - verify data accuracy');
            riskLevel = 'medium';
        }

        if (risks.length === 0) {
            risks.push('No significant risks detected');
        }

        return { riskLevel, risks };
    }

    /**
     * Main scanner: find all spot-futures arbitrage opportunities
     */
    async scanOpportunities() {
        console.log('🔍 Starting Spot-Futures Arbitrage scan...');
        const opportunities = [];
        const fundingRates = [];

        // Pre-initialize all exchanges before scanning (avoids concurrent init issues)
        for (const exchangeConfig of this.exchangeConfigs) {
            const { name: exchangeName, spotType, futuresType } = exchangeConfig;
            console.log(`📡 Initializing ${exchangeName}...`);
            await this.initializeExchange(exchangeName, 'spot');
            await this.initializeExchange(exchangeName, futuresType);
        }

        for (const exchangeConfig of this.exchangeConfigs) {
            const { name: exchangeName, spotType, futuresType } = exchangeConfig;
            console.log(`📡 Scanning ${exchangeName}...`);

            const symbolPromises = this.symbols.map(async (symbol) => {
                try {
                    // Fetch spot + futures + funding in parallel
                    const [spotData, futuresData, fundingData] = await Promise.all([
                        this.fetchSpotPrice(exchangeName, symbol),
                        this.fetchFuturesPrice(exchangeName, futuresType, symbol),
                        this.fetchFundingRate(exchangeName, futuresType, symbol),
                    ]);

                    // Store funding rate data
                    if (fundingData) {
                        fundingRates.push({
                            exchange: exchangeName,
                            symbol: symbol,
                            fundingRate: fundingData.fundingRate,
                            fundingRatePct: Number((fundingData.fundingRate * 100).toFixed(4)),
                            annualizedPct: Number((fundingData.fundingRate * 3 * 365 * 100).toFixed(2)),
                            dailyPct: Number((fundingData.fundingRate * 3 * 100).toFixed(4)),
                            nextFundingTime: fundingData.nextFundingTimestamp,
                            markPrice: fundingData.markPrice,
                            indexPrice: fundingData.indexPrice,
                        });
                    }

                    // Need both spot and futures data for arbitrage
                    if (!spotData || !futuresData) return null;

                    const fundingRate = fundingData ? fundingData.fundingRate : 0;

                    // Calculate profit metrics
                    const profitMetrics = this.calculateNetProfit(
                        spotData.price, futuresData.price, fundingRate, exchangeName
                    );

                    // Assess risk
                    const riskData = this.assessRisk({
                        fundingRate,
                        spotVolume: spotData.volume,
                        futuresVolume: futuresData.volume,
                        spreadPct: profitMetrics.spreadPct,
                    });

                    // Direction: positive spread = futures premium (normal), negative = futures discount (backwardation)
                    const direction = profitMetrics.spreadPct >= 0 ? 'contango' : 'backwardation';
                    const strategy = direction === 'contango'
                        ? 'Buy Spot + Short Futures'
                        : 'Short Spot + Buy Futures';

                    return {
                        symbol,
                        exchange: exchangeName,
                        spotPrice: Number(spotData.price.toFixed(4)),
                        futuresPrice: Number(futuresData.price.toFixed(4)),
                        spotVolume: Number(spotData.volume.toFixed(2)),
                        futuresVolume: Number(futuresData.volume.toFixed(2)),
                        fundingRate: Number((fundingRate * 100).toFixed(4)),
                        dailyFundingPct: profitMetrics.dailyFundingPct,
                        spreadPct: profitMetrics.spreadPct,
                        netProfitPct: profitMetrics.netProfitPct,
                        netProfitUSD: profitMetrics.netProfitUSD,
                        totalFeesPct: profitMetrics.totalFeesPct,
                        grossProfitPct: profitMetrics.grossProfitPct,
                        direction,
                        strategy,
                        riskLevel: riskData.riskLevel,
                        risks: riskData.risks,
                        timestamp: Date.now()
                    };
                } catch (err) {
                    console.warn(`❌ Error scanning ${exchangeName} ${symbol}: ${err.message}`);
                    return null;
                }
            });

            const results = await Promise.all(symbolPromises);
            results.filter(Boolean).forEach(r => opportunities.push(r));
        }

        // Sort by gross profit descending
        opportunities.sort((a, b) => b.grossProfitPct - a.grossProfitPct);
        fundingRates.sort((a, b) => b.dailyPct - a.dailyPct);

        console.log(`✅ Spot-Futures scan complete. Found ${opportunities.length} opportunities.`);

        return {
            opportunities,
            fundingRates,
            summary: this.generateSummary(opportunities, fundingRates),
            lastUpdated: new Date().toISOString(),
        };
    }

    /**
     * Generate summary stats for admin and users
     */
    generateSummary(opportunities, fundingRates) {
        const profitable = opportunities.filter(o => o.netProfitPct > 0);
        const highProfit = opportunities.filter(o => o.netProfitPct > 1);

        const avgSpread = opportunities.length > 0
            ? opportunities.reduce((sum, o) => sum + Math.abs(o.spreadPct), 0) / opportunities.length
            : 0;

        const avgFunding = fundingRates.length > 0
            ? fundingRates.reduce((sum, f) => sum + f.dailyPct, 0) / fundingRates.length
            : 0;

        const topOpportunity = opportunities[0] || null;

        const bestFundingRate = fundingRates.length > 0 ? fundingRates[0] : null;

        return {
            totalScanned: opportunities.length,
            profitableCount: profitable.length,
            highProfitCount: highProfit.length,
            avgSpreadPct: Number(avgSpread.toFixed(4)),
            avgDailyFundingPct: Number(avgFunding.toFixed(4)),
            topOpportunity: topOpportunity ? {
                symbol: topOpportunity.symbol,
                exchange: topOpportunity.exchange,
                netProfitPct: topOpportunity.netProfitPct,
            } : null,
            bestFundingRate: bestFundingRate ? {
                symbol: bestFundingRate.symbol,
                exchange: bestFundingRate.exchange,
                dailyPct: bestFundingRate.dailyPct,
                annualizedPct: bestFundingRate.annualizedPct,
            } : null,
            exchangesScanned: this.exchangeConfigs.map(e => e.name),
            symbolsScanned: this.symbols.length,
        };
    }

    /**
     * Calculate custom net profit (for user calculator)
     */
    calculateCustomProfit(spotPrice, futuresPrice, fundingRatePct, exchangeName, investmentUSD, daysHeld) {
        const fundingRate = fundingRatePct / 100; // Convert from percentage
        return this.calculateNetProfit(spotPrice, futuresPrice, fundingRate, exchangeName, investmentUSD, daysHeld);
    }
}

module.exports = SpotFuturesArbitrageService;
