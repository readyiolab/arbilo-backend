const ccxt = require("ccxt");

class TriangularArbitrageFinder {
  constructor() {
    console.log("🔧 Initializing TriangularArbitrageFinder...");
    this.exchangeNames = [ "bybit", "okx", "kucoin", "gate.io","binance"]; // Start with just Binance for testing
    this.baseCurrencies = ["USDT"]; // Start with just USDT
    this.tradingCoins = ["BTC", "ETH", "ADA", "DOT", "MATIC"]; // More coins for better chances
    this.MIN_PROFIT_PERCENTAGE = -2; // Very low threshold for testing (even losses)
    this.MIN_VOLUME = 500000; // Very low volume requirement
    this.STARTING_AMOUNT = 1000;
    this.MAX_SLIPPAGE = 3;
    console.log("🔧 Configuration:", {
      exchanges: this.exchangeNames,
      baseCurrencies: this.baseCurrencies,
      tradingCoins: this.tradingCoins,
      minProfit: this.MIN_PROFIT_PERCENTAGE,
      minVolume: this.MIN_VOLUME,
      startingAmount: this.STARTING_AMOUNT,
      maxSlippage: this.MAX_SLIPPAGE,
    });
  }

  async findTriangularOpportunities() {
    console.log("🔺 Starting Triangular Arbitrage Analysis...");
    console.log("⏳ This process may take several minutes...\n");

    const allOpportunities = [];
    let totalSetsAnalyzed = 0;
    let validPairSets = 0;

    for (const exchangeName of this.exchangeNames) {
      try {
        console.log(`🔍 Analyzing ${exchangeName}...`);
        const result = await this.analyzeExchange(exchangeName);
        console.log(`📊 Analysis result for ${exchangeName}:`, {
          opportunities: result.opportunities.length,
          setsAnalyzed: result.setsAnalyzed,
          validSets: result.validSets
        });
        
        allOpportunities.push(...result.opportunities);
        totalSetsAnalyzed += result.setsAnalyzed;
        validPairSets += result.validSets;

      } catch (error) {
        console.error(`❌ Error analyzing ${exchangeName}:`, error.message);
      }
    }

    console.log(`\n📈 ANALYSIS SUMMARY:`);
    console.log(`Total sets analyzed: ${totalSetsAnalyzed}`);
    console.log(`Valid pair sets found: ${validPairSets}`);
    console.log(`Opportunities found: ${allOpportunities.length}\n`);

    const sortedOpportunities = allOpportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
    this.displayResults(sortedOpportunities);
    return sortedOpportunities;
  }

  async analyzeExchange(exchangeName) {
    try {
      console.log(`🛠️ Initializing exchange ${exchangeName}...`);
      const exchange = new ccxt[exchangeName]({
        enableRateLimit: true,
        rateLimit: 100,
        timeout: 30000,
        sandbox: false,
      });

      console.log(`📡 Loading markets for ${exchangeName}...`);
      await exchange.loadMarkets();
      const totalMarkets = Object.keys(exchange.markets).length;
      console.log(`✅ Markets loaded for ${exchangeName}: ${totalMarkets} pairs`);

      // Debug: Show some available pairs
      const samplePairs = Object.keys(exchange.markets).slice(0, 10);
      console.log(`📋 Sample pairs:`, samplePairs);

      const opportunities = [];
      let setsAnalyzed = 0;
      let validSets = 0;

      for (const baseCurrency of this.baseCurrencies) {
        console.log(`\n🔄 Generating triangular sets for ${baseCurrency}...`);
        const triangularSets = this.generateTriangularSets(baseCurrency);
        console.log(`📋 Generated ${triangularSets.length} triangular sets for ${baseCurrency}`);

        for (const set of triangularSets) {
          setsAnalyzed++;
          try {
            console.log(`\n🧮 [${setsAnalyzed}] Analyzing set:`, set);
            
            // Check if all required pairs exist
            const pairCheck = this.checkPairAvailability(exchange, set);
            if (!pairCheck.allExist) {
              console.log(`⏭️ Skipping: Missing pairs - ${pairCheck.missing.join(', ')}`);
              continue;
            }
            
            validSets++;
            console.log(`✅ All pairs exist: ${pairCheck.existing.join(', ')}`);
            
            const opportunity = await this.calculateTriangularArbitrage(exchange, set, exchangeName);
            if (opportunity) {
              console.log(`🎯 Found result: ${opportunity.profitPercentage.toFixed(4)}% profit`);
              opportunities.push(opportunity);
            } else {
              console.log(`ℹ️ No opportunity calculated`);
            }
            
            // Add small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`❌ Error calculating arbitrage for set ${JSON.stringify(set)}:`, error.message);
            continue;
          }
        }
      }

      console.log(`🏁 Finished analyzing ${exchangeName}`);
      return {
        opportunities,
        setsAnalyzed,
        validSets
      };
    } catch (error) {
      console.error(`❌ Failed to initialize ${exchangeName}:`, error.message);
      return {
        opportunities: [],
        setsAnalyzed: 0,
        validSets: 0
      };
    }
  }

  checkPairAvailability(exchange, set) {
    const { base, coinA, coinB } = set;
    const pair1 = `${coinA}/${base}`;
    const pair2 = `${coinB}/${base}`;
    const pair3 = `${coinA}/${coinB}`;
    const reversePair3 = `${coinB}/${coinA}`;

    const pairs = [pair1, pair2];
    const existing = [];
    const missing = [];

    // Check main pairs
    pairs.forEach(pair => {
      if (this.pairExists(exchange, pair)) {
        existing.push(pair);
      } else {
        missing.push(pair);
      }
    });

    // Check third pair (either direction)
    let thirdPair = null;
    if (this.pairExists(exchange, pair3)) {
      existing.push(pair3);
      thirdPair = pair3;
    } else if (this.pairExists(exchange, reversePair3)) {
      existing.push(reversePair3);
      thirdPair = reversePair3;
    } else {
      missing.push(`${pair3} or ${reversePair3}`);
    }

    return {
      allExist: missing.length === 0,
      existing,
      missing,
      thirdPair,
      isReversePair: thirdPair === reversePair3
    };
  }

  generateTriangularSets(baseCurrency) {
    console.log(`🔨 Generating triangular sets for base: ${baseCurrency}`);
    const sets = [];
    const availableCoins = this.tradingCoins.filter((coin) => coin !== baseCurrency);
    console.log(`📌 Available coins for ${baseCurrency}:`, availableCoins);

    for (let i = 0; i < availableCoins.length; i++) {
      for (let j = i + 1; j < availableCoins.length; j++) {
        const set = {
          base: baseCurrency,
          coinA: availableCoins[i],
          coinB: availableCoins[j],
        };
        sets.push(set);
      }
    }

    console.log(`📊 Total sets generated: ${sets.length}`);
    return sets;
  }

  async calculateTriangularArbitrage(exchange, set, exchangeName) {
    const { base, coinA, coinB } = set;
    
    const pairCheck = this.checkPairAvailability(exchange, set);
    if (!pairCheck.allExist) {
      return null;
    }

    const pair1 = `${coinA}/${base}`;
    const pair2 = `${coinB}/${base}`;
    const pair3ToUse = pairCheck.thirdPair;
    const isReversePair = pairCheck.isReversePair;

    try {
      console.log(`📥 Fetching data for pairs: ${pair1}, ${pair2}, ${pair3ToUse}`);
      
      // Fetch tickers first (faster)
      const [ticker1, ticker2, ticker3] = await Promise.all([
        exchange.fetchTicker(pair1),
        exchange.fetchTicker(pair2),
        exchange.fetchTicker(pair3ToUse),
      ]);

      console.log(`📊 Current prices:`, {
        [pair1]: ticker1.last,
        [pair2]: ticker2.last,
        [pair3ToUse]: ticker3.last,
      });

      // Use simpler price calculation with ticker prices first
      const path1 = this.calculatePathWithTickers(ticker1, ticker2, ticker3, set, isReversePair, 1);
      const path2 = this.calculatePathWithTickers(ticker1, ticker2, ticker3, set, isReversePair, 2);
      
      console.log(`📊 Path results:`, {
        path1: `${path1.profitPercentage.toFixed(4)}%`,
        path2: `${path2.profitPercentage.toFixed(4)}%`
      });

      const bestPath = path1.profitPercentage > path2.profitPercentage ? path1 : path2;

      // Return result regardless of profitability for debugging
      return {
        exchange: exchangeName,
        baseCurrency: base,
        coins: [coinA, coinB],
        path: bestPath.pathDescription,
        profitPercentage: bestPath.profitPercentage,
        profitAmount: bestPath.profitAmount,
        startingAmount: this.STARTING_AMOUNT,
        finalAmount: bestPath.finalAmount,
        trades: bestPath.trades,
        prices: {
          [pair1]: ticker1.last,
          [pair2]: ticker2.last,
          [pair3ToUse]: ticker3.last,
        },
        volumes: {
          [pair1]: this.formatVolume(ticker1),
          [pair2]: this.formatVolume(ticker2),
          [pair3ToUse]: this.formatVolume(ticker3),
        },
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`❌ Error fetching data for ${JSON.stringify(set)}:`, error.message);
      return null;
    }
  }

  calculatePathWithTickers(ticker1, ticker2, ticker3, set, isReversePair, pathNumber) {
    const { base, coinA, coinB } = set;
    let amount = this.STARTING_AMOUNT;
    const trades = [];

    if (pathNumber === 1) {
      // Path 1: base → coinA → coinB → base
      console.log(`🛤️ Calculating Path 1: ${base} → ${coinA} → ${coinB} → ${base}`);
      
      const buyPriceA = ticker1.ask || ticker1.last;
      const amountCoinA = amount / buyPriceA;
      trades.push({
        step: 1,
        action: "BUY",
        pair: `${coinA}/${base}`,
        price: buyPriceA,
        amount: amountCoinA,
        description: `Buy ${amountCoinA.toFixed(6)} ${coinA} with ${amount} ${base}`,
      });

      let amountCoinB;
      if (isReversePair) {
        const buyPriceBA = ticker3.ask || ticker3.last;
        amountCoinB = amountCoinA / buyPriceBA;
        trades.push({
          step: 2,
          action: "BUY",
          pair: `${coinB}/${coinA}`,
          price: buyPriceBA,
          amount: amountCoinB,
          description: `Buy ${amountCoinB.toFixed(6)} ${coinB} with ${amountCoinA.toFixed(6)} ${coinA}`,
        });
      } else {
        const sellPriceAB = ticker3.bid || ticker3.last;
        amountCoinB = amountCoinA * sellPriceAB;
        trades.push({
          step: 2,
          action: "SELL",
          pair: `${coinA}/${coinB}`,
          price: sellPriceAB,
          amount: amountCoinA,
          description: `Sell ${amountCoinA.toFixed(6)} ${coinA} for ${amountCoinB.toFixed(6)} ${coinB}`,
        });
      }

      const sellPriceB = ticker2.bid || ticker2.last;
      const finalAmount = amountCoinB * sellPriceB;
      trades.push({
        step: 3,
        action: "SELL",
        pair: `${coinB}/${base}`,
        price: sellPriceB,
        amount: amountCoinB,
        description: `Sell ${amountCoinB.toFixed(6)} ${coinB} for ${finalAmount.toFixed(2)} ${base}`,
      });

      const profit = finalAmount - this.STARTING_AMOUNT;
      const profitPercentage = (profit / this.STARTING_AMOUNT) * 100;

      return {
        pathDescription: `${base} → ${coinA} → ${coinB} → ${base}`,
        profitPercentage: parseFloat(profitPercentage.toFixed(4)),
        profitAmount: parseFloat(profit.toFixed(2)),
        finalAmount: parseFloat(finalAmount.toFixed(2)),
        trades,
      };
    } else {
      // Path 2: base → coinB → coinA → base
      console.log(`🛤️ Calculating Path 2: ${base} → ${coinB} → ${coinA} → ${base}`);
      
      const buyPriceB = ticker2.ask || ticker2.last;
      const amountCoinB = amount / buyPriceB;
      trades.push({
        step: 1,
        action: "BUY",
        pair: `${coinB}/${base}`,
        price: buyPriceB,
        amount: amountCoinB,
        description: `Buy ${amountCoinB.toFixed(6)} ${coinB} with ${amount} ${base}`,
      });

      let amountCoinA;
      if (isReversePair) {
        const sellPriceBA = ticker3.bid || ticker3.last;
        amountCoinA = amountCoinB * sellPriceBA;
        trades.push({
          step: 2,
          action: "SELL",
          pair: `${coinB}/${coinA}`,
          price: sellPriceBA,
          amount: amountCoinB,
          description: `Sell ${amountCoinB.toFixed(6)} ${coinB} for ${amountCoinA.toFixed(6)} ${coinA}`,
        });
      } else {
        const buyPriceBA = ticker3.ask || ticker3.last;
        amountCoinA = amountCoinB / buyPriceBA;
        trades.push({
          step: 2,
          action: "BUY",
          pair: `${coinA}/${coinB}`,
          price: buyPriceBA,
          amount: amountCoinA,
          description: `Buy ${amountCoinA.toFixed(6)} ${coinA} with ${amountCoinB.toFixed(2)} ${coinB}`,
        });
      }

      const sellPriceA = ticker1.bid || ticker1.last;
      const finalAmount = amountCoinA * sellPriceA;
      trades.push({
        step: 3,
        action: "SELL",
        pair: `${coinA}/${base}`,
        price: sellPriceA,
        amount: amountCoinA,
        description: `Sell ${amountCoinA.toFixed(6)} ${coinA} for ${finalAmount.toFixed(2)} ${base}`,
      });

      const profit = finalAmount - this.STARTING_AMOUNT;
      const profitPercentage = (profit / this.STARTING_AMOUNT) * 100;

      return {
        pathDescription: `${base} → ${coinB} → ${coinA} → ${base}`,
        profitPercentage: parseFloat(profitPercentage.toFixed(4)),
        profitAmount: parseFloat(profit.toFixed(2)),
        finalAmount: parseFloat(finalAmount.toFixed(2)),
        trades,
      };
    }
  }

  pairExists(exchange, pair) {
    const exists = exchange.markets && exchange.markets[pair] && exchange.markets[pair].active;
    return exists;
  }

  formatVolume(ticker) {
    const volume = ticker.quoteVolume || (ticker.baseVolume * ticker.last) || 0;
    return volume.toFixed(0);
  }

  displayResults(opportunities) {
    console.log("\n" + "=".repeat(80));
    console.log("🔴 TRIANGULAR ARBITRAGE ANALYSIS RESULTS");
    console.log("=".repeat(80));

    if (opportunities.length === 0) {
      console.log("\n❌ No opportunities found in this analysis.");
      console.log("💡 This is normal - arbitrage opportunities are rare and short-lived.");
      console.log("💡 Try running again or adjusting parameters.");
      return;
    }

    console.log(`\n✅ Found ${opportunities.length} calculation results:\n`);

    opportunities.slice(0, 10).forEach((opp, index) => {
      const profitColor = opp.profitPercentage > 0 ? "💰" : "📉";
      console.log(`${profitColor} Result ${index + 1}: ${opp.exchange.toUpperCase()}`);
      console.log(`🔄 Path: ${opp.path}`);
      console.log(`📊 Result: ${opp.profitPercentage}% (${opp.profitAmount} ${opp.baseCurrency})`);
      console.log(`💵 Amount: ${opp.startingAmount} → ${opp.finalAmount} ${opp.baseCurrency}`);

      console.log("📋 Trade Steps:");
      opp.trades.forEach((trade) => {
        console.log(`   ${trade.step}. ${trade.description}`);
      });

      console.log("💱 Prices Used:");
      Object.entries(opp.prices).forEach(([pair, price]) => {
        console.log(`   ${pair}: $${price}`);
      });

      console.log(`🕐 Calculated at: ${new Date(opp.timestamp).toLocaleString()}`);
      console.log("");
    });

    console.log("=".repeat(80));
    console.log("⚠️ IMPORTANT NOTES:");
    console.log("• These are theoretical calculations using current prices");
    console.log("• Real trading involves fees, slippage, and timing delays");
    console.log("• Profitable opportunities are extremely rare and short-lived");
    console.log("• Always test with small amounts first");
    console.log("=".repeat(80));
  }

  // Quick test method
  async quickTest() {
    console.log("🚀 Running quick test...");
    try {
      const exchange = new ccxt.binance({ enableRateLimit: true });
      await exchange.loadMarkets();
      
      // Test a simple set
      const testSet = { base: "USDT", coinA: "BTC", coinB: "ETH" };
      console.log("Testing set:", testSet);
      
      const result = await this.calculateTriangularArbitrage(exchange, testSet, "binance");
      console.log("Test result:", result);
      
      return result;
    } catch (error) {
      console.error("Quick test failed:", error.message);
      return null;
    }
  }
}

module.exports = TriangularArbitrageFinder;