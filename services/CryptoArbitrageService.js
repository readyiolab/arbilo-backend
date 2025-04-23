const ccxt = require('ccxt');

class CryptoArbitrageService {
    constructor() {
        this.exchangeNames = [
            'binance', 
            'bybit', 
            'p2b',
            'xt',
            'woo',
            'okx', 
            'crypto.com', 
            'gate.io', 
            'bitget', 
            'mexc', 
            'htx',
            'kraken', 
            'kucoin', 
            'bitfinex', 
            'bitmart', 
            'bitmex',
            'poloniex', 
            'probit',
            'phemex',
            'whitebit', 
            'ascendex',
            'bitget',
        ];

        this.coinSymbols = [
            'BTC', 'ETH', 'XRP', 'ADA', 'DOT', 'SOL', 'DOGE', 'SHIB', 'LTC', 'LINK',
            'MATIC', 'AVAX', 'XLM', 'UNI', 'BCH', 'FIL', 'VET', 'ALGO', 'ATOM', 'ICP'
        ];

        this.MIN_VOLUME = 100000; // Minimum 24h volume in USDT
        this.MAX_RETRIES = 3;
        this.RETRY_DELAY = 500;
        this.exchanges = {};
    }

    async initializeExchange(exchangeName) {
        try {
            if (!this.exchanges[exchangeName]) {
                this.exchanges[exchangeName] = new ccxt[exchangeName]({ timeout: 20000 });
                await this.exchanges[exchangeName].loadMarkets();
            }
        } catch (err) {
            console.warn(`⚠️ Skipping ${exchangeName}: ${err.message}`);
            delete this.exchanges[exchangeName];
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchMarketDataWithRetry(exchange, pair, retries = 0) {
        try {
            await this.delay(this.RETRY_DELAY);
            const ticker = await exchange.fetchTicker(pair);
            return {
                price: ticker.last,
                volume: ticker.quoteVolume || ticker.baseVolume * ticker.last, // Convert to USDT volume if needed
                timestamp: Date.now()
            };
        } catch (error) {
            if (retries < this.MAX_RETRIES) {
                console.log(`🔄 Retrying ${pair} on ${exchange.name} (${retries + 1}/${this.MAX_RETRIES})`);
                await this.delay(this.RETRY_DELAY * (retries + 1));
                return this.fetchMarketDataWithRetry(exchange, pair, retries + 1);
            }
            console.error(`❌ Failed to fetch ${pair} from ${exchange.name}: ${error.message}`);
            return null;
        }
    }

    async fetchExchangePrices(exchangeName) {
        await this.initializeExchange(exchangeName);
        const exchange = this.exchanges[exchangeName];
        if (!exchange) return {};

        const marketData = {};
        const fetchPromises = this.coinSymbols.map(async (coin) => {
            const pair = `${coin}/USDT`;
            if (!exchange.markets[pair]) {
                console.log(`⚠️ ${exchangeName} does not support ${pair}`);
                return;
            }

            try {
                const data = await this.fetchMarketDataWithRetry(exchange, pair);
                if (data && data.volume >= this.MIN_VOLUME) {
                    marketData[coin] = data;
                } else if (data) {
                    console.log(`⚠️ ${pair} on ${exchangeName} has insufficient volume (${data.volume.toFixed(2)} USDT)`);
                }
            } catch (err) {
                console.log(`❌ Error fetching ${pair} from ${exchangeName}: ${err.message}`);
            }
        });

        await Promise.all(fetchPromises);
        return marketData;
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
        return cryptoData;
    }

    calculateProfitForPair(investment, minPrice1, minPrice2, maxPrice1, maxPrice2) {
        const coin1Bought = investment / minPrice1;
        const moneyAfterSellingCoin1 = coin1Bought * maxPrice1;
        const coin2Bought = moneyAfterSellingCoin1 / maxPrice2;
        const finalAmount = coin2Bought * minPrice2;

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
        if (!cryptoData || Object.keys(cryptoData).length === 0) {
            console.warn("⚠️ No crypto data available");
            return [];
        }

        const results = [];
        const coinPairs = this.createCoinPairs();

        for (const [coin1, coin2] of coinPairs) {
            const validExchanges = this.exchangeNames.filter(exchange =>
                cryptoData[exchange]?.[coin1]?.price > 0 && 
                cryptoData[exchange]?.[coin2]?.price > 0
            );

            if (validExchanges.length < 2) continue;

            const opportunities = validExchanges.map(exchange => ({
                exchange,
                price1: cryptoData[exchange][coin1]?.price,
                price2: cryptoData[exchange][coin2]?.price,
                volume1: cryptoData[exchange][coin1]?.volume,
                volume2: cryptoData[exchange][coin2]?.volume
            })).filter(o => 
                o.price1 && 
                o.price2 && 
                o.volume1 >= this.MIN_VOLUME && 
                o.volume2 >= this.MIN_VOLUME
            );

            if (opportunities.length < 2) continue;

            opportunities.sort((a, b) => a.price1 - b.price1);
            const minOpp = opportunities[0];
            opportunities.sort((a, b) => b.price1 - a.price1);
            const maxOpp = opportunities[0];

            if (minOpp && maxOpp && minOpp.exchange !== maxOpp.exchange) {
                const profit = this.calculateProfitForPair(
                    initialInvestment,
                    minOpp.price1, minOpp.price2,
                    maxOpp.price1, maxOpp.price2
                );

                if (profit.profit > 0) {
                    results.push({
                        pair: `${coin1} / ${coin2}`,
                        coin1,
                        coin2,
                        minExchange: minOpp.exchange,
                        maxExchange: maxOpp.exchange,
                        minPrice1: Number(minOpp.price1.toFixed(8)),
                        minPrice2: Number(minOpp.price2.toFixed(8)),
                        maxPrice1: Number(maxOpp.price1.toFixed(8)),
                        maxPrice2: Number(maxOpp.price2.toFixed(8)),
                        volume1Min: Number(minOpp.volume1.toFixed(2)),
                        volume2Min: Number(minOpp.volume2.toFixed(2)),
                        volume1Max: Number(maxOpp.volume1.toFixed(2)),
                        volume2Max: Number(maxOpp.volume2.toFixed(2)),
                        profit: Number(profit.profit.toFixed(2)),
                        profitPercentage: Number(profit.profitPercentage.toFixed(2)),
                        investmentAmount: initialInvestment
                    });
                }
            }
        }

        return results.sort((a, b) => b.profit - a.profit);
    }

    async getArbitrageOpportunities(investment) {
        try {
            console.log("🔍 Fetching crypto prices and volumes...");
            const cryptoData = await this.fetchAllPrices();
            console.log("✅ Data fetched. Calculating arbitrage opportunities...");
            const results = this.calculateArbitrageProfit(cryptoData, investment);
            return { results: results.slice(0, 20), lastUpdated: new Date().toISOString() };
        } catch (error) {
            console.error("❌ Error calculating arbitrage opportunities:", error);
            return { results: [], lastUpdated: new Date().toISOString() };
        }
    }
}

module.exports = CryptoArbitrageService;