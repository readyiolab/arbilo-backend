const CacheService = require('./CacheService');
const CryptoArbitrageService = require('./CryptoArbitrageService');
const SpotFuturesArbitrageService = require('./SpotFuturesArbitrageService');

let started = false;

function startBackgroundScans() {
  if (started) return;
  started = true;

  const cryptoService = new CryptoArbitrageService();
  const sfService = new SpotFuturesArbitrageService();
  const DEFAULT_INVESTMENT = 100000;

  CacheService.startMasterRefresh([
    {
      key: CacheService.CACHE_KEYS.ARBI_TRACK,
      fetchFunction: () => cryptoService.getArbiTrackData(),
    },
    {
      key: CacheService.arbipairKey(DEFAULT_INVESTMENT),
      fetchFunction: () => cryptoService.getArbitrageOpportunities(DEFAULT_INVESTMENT),
    },
    {
      key: CacheService.CACHE_KEYS.SPOT_FUTURES,
      fetchFunction: () => sfService.scanOpportunities(),
    },
  ]);
}

module.exports = { startBackgroundScans };
