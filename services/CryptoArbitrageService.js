const ccxt = require('ccxt');
const config = require('../config/arbitrageConfig');

class CryptoArbitrageService {
    constructor() {
        this.exchangeNames = config.EXCHANGE_NAMES;
        this.coinSymbols = config.COIN_SYMBOLS;
        this.MIN_VOLUME = config.MIN_VOLUME;
        this.MAX_RETRIES = config.MAX_RETRIES;
        this.RETRY_DELAY = config.RETRY_DELAY;
        this.MAX_PRICE_AGE = config.MAX_PRICE_AGE;
        this.exchanges = {};
    }

    async initializeExchange(exchangeName) {
        try {
            if (!this.exchanges[exchangeName]) {
                const exchange = new ccxt[exchangeName]({ 
                    timeout: 30000,
                    enableRateLimit: true 
                });
                await exchange.loadMarkets();

                if (!exchange.has['fetchTicker'] && !exchange.has['fetchTickers']) {
                    return null;
                }

                this.exchanges[exchangeName] = exchange;
            }
            return this.exchanges[exchangeName];
        } catch (err) {
            console.warn(`⚠️ Skipping ${exchangeName}: ${err.message}`);
            delete this.exchanges[exchangeName];
            return null;
        }
    }

    async fetchExchangePrices(exchangeName) {
        const exchange = await this.initializeExchange(exchangeName);
        if (!exchange) return {};

        const symbols = this.coinSymbols.map(coin => `${coin}/USDT`);
        const availableSymbols = symbols.filter(s => exchange.markets[s]);
        
        if (availableSymbols.length === 0) return {};

        const marketData = {};
        try {
            let tickers = {};
            if (exchange.has['fetchTickers']) {
                tickers = await exchange.fetchTickers(availableSymbols);
            } else {
                for (const symbol of availableSymbols) {
                    try {
                        tickers[symbol] = await exchange.fetchTicker(symbol);
                    } catch (e) {}
                }
            }

            for (const symbol of availableSymbols) {
                const ticker = tickers[symbol];
                if (!ticker || !ticker.last) continue;

                const coin = symbol.split('/')[0];
                const volumeUSDT = ticker.quoteVolume || (ticker.baseVolume * ticker.last);

                if (volumeUSDT >= this.MIN_VOLUME) {
                    marketData[coin] = {
                        price: ticker.last,
                        bid: ticker.bid || ticker.last,
                        ask: ticker.ask || ticker.last,
                        volume: volumeUSDT,
                        timestamp: Date.now()
                    };
                }
            }
        } catch (err) {
            console.error(`❌ Bulk fetch error for ${exchangeName}: ${err.message}`);
        }

        return marketData;
    }

    /**
     * Filters out glitchy/outlier prices to prevent impossible arbitrage results.
     * Uses median-based filtering (more robust than average).
     */
    filterOutliers(cryptoData) {
        const filteredData = JSON.parse(JSON.stringify(cryptoData));
        const coinPrices = {};

        // Collect all prices for each coin
        for (const exchange of Object.keys(filteredData)) {
            for (const coin of Object.keys(filteredData[exchange])) {
                if (!coinPrices[coin]) coinPrices[coin] = [];
                coinPrices[coin].push({ exchange, price: filteredData[exchange][coin].price });
            }
        }

        // Check for outliers coin by coin
        for (const coin of Object.keys(coinPrices)) {
            const prices = coinPrices[coin].map(p => p.price).sort((a, b) => a - b);
            if (prices.length < 3) continue; // Not enough data to determine outliers reliably

            const median = prices[Math.floor(prices.length / 2)];
            
            // Discard prices that are > 50% different from the median
            // Arbitrage is usually < 5%, so 50% is a safe "glitch" threshold
            for (const p of coinPrices[coin]) {
                const deviation = Math.abs(p.price - median) / median;
                if (deviation > 0.5) {
                    console.warn(`🚨 Discarding outlier price for ${coin} on ${p.exchange}: $${p.price} (Median: $${median})`);
                    delete filteredData[p.exchange][coin];
                }
            }
        }

        return filteredData;
    }

    async fetchAllPrices() {
        const cryptoData = {};
        const exchangePromises = this.exchangeNames.map(async (exchangeName) => {
            try {
                const marketData = await this.fetchExchangePrices(exchangeName);
                if (Object.keys(marketData).length > 0) {
                    cryptoData[exchangeName] = marketData;
                }
            } catch (err) {
                console.error(`❌ Error fetching data from ${exchangeName}:`, err.message);
            }
        });

        await Promise.all(exchangePromises);
        
        // Apply outlier detection before returning
        return this.filterOutliers(cryptoData);
    }

    isPriceStale(timestamp) {
        return (Date.now() - timestamp) > this.MAX_PRICE_AGE;
    }

    calculateProfitForPair(investment, buyAsk1, sellBid1, buyAsk2, sellBid2) {
        const coin1Bought = investment / buyAsk1;
        const moneyAfterSellingCoin1 = coin1Bought * sellBid1;
        const coin2Bought = moneyAfterSellingCoin1 / buyAsk2;
        const finalAmount = coin2Bought * sellBid2;

        const profit = finalAmount - investment;
        return { profit, profitPercentage: (profit / investment) * 100 };
    }

    createCoinPairs() {
        const pairs = [];
        for (let i = 0; i < this.coinSymbols.length; i++) {
            for (let j = i + 1; j < this.coinSymbols.length; j++) {
                pairs.push([this.coinSymbols[i], this.coinSymbols[j]]);
            }
        }
        return pairs;
    }

    calculateArbitrageProfit(cryptoData, initialInvestment) {
        if (!cryptoData || Object.keys(cryptoData).length === 0) return [];

        const results = [];
        const coinPairs = this.createCoinPairs();

        for (const [coin1, coin2] of coinPairs) {
            const opportunities = this.exchangeNames
                .map(exchange => {
                    const c1 = cryptoData[exchange]?.[coin1];
                    const c2 = cryptoData[exchange]?.[coin2];
                    if (!c1 || !c2 || this.isPriceStale(c1.timestamp) || this.isPriceStale(c2.timestamp)) return null;
                    return { exchange, c1, c2 };
                })
                .filter(Boolean);

            if (opportunities.length < 2) continue;

            const bestBuy = [...opportunities].sort((a, b) => a.c1.ask - b.c1.ask)[0];
            const bestSell = [...opportunities].sort((a, b) => b.c1.bid - a.c1.bid)[0];

            if (bestBuy && bestSell && bestBuy.exchange !== bestSell.exchange) {
                const profit = this.calculateProfitForPair(
                    initialInvestment,
                    bestBuy.c1.ask,
                    bestSell.c1.bid,
                    bestBuy.c2.ask,
                    bestSell.c2.bid
                );

                if (profit.profit > 0 && profit.profitPercentage < 100) { // Discard > 100% profit as likely glitch
                    results.push({
                        pair: `${coin1} - ${coin2}`,
                        coin1,
                        coin2,
                        minExchange: bestBuy.exchange,
                        maxExchange: bestSell.exchange,
                        minPrice1: bestBuy.c1.ask,
                        minPrice2: bestBuy.c2.ask,
                        maxPrice1: bestSell.c1.bid,
                        maxPrice2: bestSell.c2.bid,
                        volume1Min: bestBuy.c1.volume,
                        volume2Min: bestBuy.c2.volume,
                        volume1Max: bestSell.c1.volume,
                        volume2Max: bestSell.c2.volume,
                        profit: profit.profit,
                        profitPercentage: profit.profitPercentage,
                        investmentAmount: initialInvestment
                    });
                }
            }
        }

        return results.sort((a, b) => b.profit - a.profit);
    }

    async getArbiTrackData() {
        const cryptoData = await this.fetchAllPrices();
        const results = {};

        for (const coin of this.coinSymbols) {
            const prices = [];
            for (const exchange of this.exchangeNames) {
                const data = cryptoData[exchange]?.[coin];
                if (data && !this.isPriceStale(data.timestamp)) {
                    prices.push({ exchange, ...data });
                }
            }

            if (prices.length < 2) continue;

            const lowest = prices.reduce((min, p) => p.ask < min.ask ? p : min);
            const highest = prices.reduce((max, p) => p.bid > max.bid ? p : max);
            const profitPercentage = ((highest.bid - lowest.ask) / lowest.ask) * 100;

            // Discard insane profit percentages as glitches
            if (profitPercentage > 0 && profitPercentage < 50) {
                results[coin] = {
                    coin,
                    lowestExchange: lowest.exchange,
                    highestExchange: highest.exchange,
                    lowestPrice: lowest.ask,
                    highestPrice: highest.bid,
                    profitPercentage: profitPercentage,
                    lowestVolume: lowest.volume,
                    highestVolume: highest.volume
                };
            }
        }

        return results;
    }

    async getArbitrageOpportunities(investment) {
        try {
            const cryptoData = await this.fetchAllPrices();
            const results = this.calculateArbitrageProfit(cryptoData, investment);
            return { results: results.slice(0, 30), lastUpdated: new Date().toISOString() };
        } catch (error) {
            console.error("❌ Error calculating arbitrage opportunities:", error);
            return { results: [], lastUpdated: new Date().toISOString() };
        }
    }
}

module.exports = CryptoArbitrageService;