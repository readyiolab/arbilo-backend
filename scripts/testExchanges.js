const ccxt = require('ccxt');

const exchangeNames = [
    'binance', 'bybit', 'p2b', 'xt', 'woo', 'okx',
    'cryptocom', 'gateio', 'bitget', 'mexc', 'htx',
    'kraken', 'kucoin', 'bitfinex', 'bitmart', 'bitmex',
    'poloniex', 'probit', 'phemex', 'whitebit',
    'ascendex'
];

async function testExchanges() {
    console.log('🚀 Starting Exchange Connectivity Test...\n');
    console.log('--------------------------------------------------');
    console.log(`${'Exchange'.padEnd(15)} | ${'Init'.padEnd(6)} | ${'Ticker'.padEnd(6)} | ${'Status/Error'}`);
    console.log('--------------------------------------------------');

    for (const name of exchangeNames) {
        let initStatus = '❌';
        let tickerStatus = '❌';
        let detail = '';

        try {
            // 1. Initialize
            const exchange = new ccxt[name]({ timeout: 15000 });
            await exchange.loadMarkets();
            initStatus = '✅';

            // 2. Check for fetchTicker support
            if (!exchange.has['fetchTicker']) {
                tickerStatus = '🚫';
                detail = 'fetchTicker not supported';
            } else {
                // 3. Try to fetch a common pair
                const symbols = ['ETH/USDT', 'BTC/USDT', 'SOL/USDT'];
                let fetched = false;

                for (const symbol of symbols) {
                    if (exchange.markets[symbol]) {
                        try {
                            await exchange.fetchTicker(symbol);
                            tickerStatus = '✅';
                            detail = `Success (${symbol})`;
                            fetched = true;
                            break;
                        } catch (e) {
                            detail = e.message.substring(0, 50);
                        }
                    }
                }
                if (!fetched && !detail) detail = 'No common pairs found (ETH, BTC, SOL)';
            }

        } catch (err) {
            if (err.message.includes('403') || err.message.includes('restricted')) {
                detail = 'Region Restricted (403)';
            } else if (err.message.includes('timeout')) {
                detail = 'Request Timed Out';
            } else {
                detail = err.message.substring(0, 50);
            }
        }

        console.log(`${name.padEnd(15)} | ${initStatus.padEnd(6)} | ${tickerStatus.padEnd(6)} | ${detail}`);
    }

    console.log('--------------------------------------------------');
    console.log('\n✅ Test Complete.');
}

testExchanges();
