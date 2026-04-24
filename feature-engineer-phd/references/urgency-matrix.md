# Feature Urgency & Impact Matrix

Use this matrix to prioritize features. A "PhD Feature" must always aim for the Top-Right quadrant.

| Priority | Category | Urgency Score (1-10) | Impact on Alpha (1-10) | Description |
| :--- | :--- | :--- | :--- | :--- |
| **P0** | **Leading Macro** | 9 - 10 | 8 - 10 | Features capturing whale moves before they happen (e.g., Aggregated Order Flow Delta). |
| **P1** | **Micro-Structural** | 7 - 8 | 6 - 8 | Features capturing liquidity absorption and rekt events (e.g., Absorption Index). |
| **P2** | **Trend Confirmation** | 4 - 6 | 4 - 6 | Normalized momentum indicators (e.g., ATR-Weighted EMA Deviation). |
| **P3** | **Contextual Info** | 1 - 3 | 2 - 4 | Useful but secondary data (e.g., 24h Volume Rank, Funding Rate stability). |

## How to Determine Urgency?

1. **Market Condition**: Is the market currently in a high-volatility regime? (High urgency for volatility features).
2. **Signal Decay**: Does the signal lose its predictive power within seconds? (Extreme urgency).
3. **Institutional Relevance**: Does this feature directly monitor the players who move the market? (High urgency).

## How to Determine Impact?

1. **Sharpe Ratio Contribution**: Does adding this feature historically improve the return/risk ratio?
2. **Drawdown Reduction**: Does it help the bot stay out of bad trades (False Breakouts)?
3. **Confidence Alignment**: Does it correlate with AI's highest confidence trades?
