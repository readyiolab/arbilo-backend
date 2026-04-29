# Arbilo Arbitrage Overview (Client-Friendly)

Arbitrage means buying and selling the same asset (or related assets) at slightly different prices to capture a small, low-risk profit. The system watches multiple exchanges in real time, filters out weak signals, and highlights the best opportunities.

## 1) Spot-to-Spot Arbitrage (Exchange vs Exchange)
Goal: Buy a coin cheaper on one exchange and sell it higher on another.

Step by step:
1. The system connects to many exchanges through a single data layer.
2. It continuously pulls live prices for a fixed list of coins.
3. It uses bid/ask prices (realistic buy/sell prices, not just last price).
4. It ignores coins with low 24h volume or stale prices.
5. For each coin, it finds:
   - Lowest ask (best place to buy)
   - Highest bid (best place to sell)
6. It calculates the potential profit after accounting for spreads.
7. If the profit is positive and meaningful, it is shown as an opportunity.

## 2) Spot-Futures Arbitrage (Same Exchange)
Goal: Capture the price difference between spot and futures on the same exchange.

Step by step:
1. The system checks exchanges that offer both spot and futures.
2. It pulls spot price and futures price for the same symbol.
3. It also reads the funding rate (extra cost or reward for holding futures).
4. It calculates the real net profit by including:
   - The price spread (futures vs spot)
   - Estimated trading fees
   - Funding rate impact
5. It labels the direction automatically:
   - If futures is higher: Buy spot, short futures
   - If futures is lower: Short spot, buy futures
6. It scores the opportunity and flags risks (like funding working against you).

## 3) Triangular Arbitrage (Three-Trade Loop)
Goal: Use 3 trades inside one exchange to grow the starting amount.

Example path: USDT -> BTC -> ETH -> USDT

Step by step:
1. The system picks a base currency (like USDT).
2. It builds all valid 3-pair loops on the same exchange.
3. It checks if all pairs exist and are liquid.
4. It simulates both trade directions to see which path returns more.
5. If the ending amount is higher than the starting amount, it is shown.

## Why this is reliable
- Uses real buy/sell prices (bid/ask), not optimistic last price.
- Filters out low-volume markets and stale prices.
- Uses retry logic to avoid bad data spikes.
- Includes fees and funding impact in calculations.

## Important client notes
- Arbitrage profits are small but frequent.
- Speed matters; opportunities can disappear fast.
- Results are signals, not guaranteed profits.
- Exchanges have fees, limits, and execution risks.
