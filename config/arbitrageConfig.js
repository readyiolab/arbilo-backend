/**
 * Arbitrage Configuration
 * Centralized settings for coins, exchanges, and volume requirements.
 */

module.exports = {
    // List of exchanges to monitor
    EXCHANGE_NAMES: [
        'binance',
        'bybit',
        'p2b',
        'xt',
        'woo',
        'mexc',
        'gateio',
        'bitget',
        'htx',
        'kucoin',
        'phemex',
        'whitebit'
    ],

    // List of coins to track against USDT
    COIN_SYMBOLS: [
        'ETH', 'XRP', 'ADA', 'DOT', 'SOL', 'DOGE', 'SHIB', 'LTC', 'LINK',
        'POL', 'AVAX', 'XLM', 'UNI', 'BCH', 'FIL', 'VET', 'ALGO', 'ATOM', 'ICP',
        'PEPE', 'BONK', 'TIA', 'SEI', 'SUI', 'NEAR', 'INJ', 'OP', 'ARB', 'FET', 'RNDR'
    ],

    // Global volume threshold in USDT (24h volume)
    MIN_VOLUME: 100000,

    // Cache Time-To-Live in seconds (5 minutes)
    CACHE_TTL: 300,

    // Maximum age of price data before it's considered stale (30 seconds)
    MAX_PRICE_AGE: 30000,

    // Retry settings for failed API calls
    MAX_RETRIES: 3,
    RETRY_DELAY: 500
};
