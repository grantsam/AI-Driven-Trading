# GEMINI.md

## Project Overview: OpenClaw Quant Trader
A fully automated cryptocurrency trading bot ("financial engine") built with TypeScript and Node.js. It leverages the Gemini API as a "Signal Analyst" for market structure shifts and liquidity sweeps, with a strict backend "Risk Manager" for trade execution.

## Project Mission & Principles
1. **Capital Preservation First:** Every line of code must prioritize risk management and alpha generation over aesthetics.
2. **Strict Typing:** Mandatory for all financial data to prevent overflow or precision errors.
3. **Phase-Based Development:** Adhere strictly to the current phase (Phase 3: Paper Trading) before moving to subsequent phases.
4. **Security:** Never hardcode secrets; use `.env` files. Ensure robust error handling and retries for all API calls.
5. **Deterministic Prompts:** Gemini prompts must be zero-shot/few-shot optimized and return strict JSON (no markdown blocks).

## Tech Stack & Infrastructure
- **Runtime:** Node.js v22.x
- **Language:** TypeScript (Strict typing mandatory)
- **AI Framework:** OpenClaw
- **Market Data:** CCXT (RESTful polling only, NO WebSockets)
- **Database:** PostgreSQL (UUID v4 for primary keys)
- **Infrastructure:** Dockerized container on Linux VPS

## AI DRIVEN TRADING Engineering Protocol (Mandatory)
1. **Execution Environment:** Use Docker ONLY. All commands must run inside `quant-trader-app`.
   - **Command Pattern:** `docker exec quant-trader-app npx tsx <path_to_file>`
2. **Connectivity:** Ensure `compose.yaml` includes public DNS (e.g., 8.8.8.8) to prevent Binance API `fetch failed` errors.
3. **Data Integrity:** Use UUID v4 for ALL primary keys in PostgreSQL.
4. **Strategy Blueprint (Short Squeeze Trap):**
   - **Conditions:** Funding Rate < 0 AND Top Traders L/S Ratio < 1.0.
   - **Logic:** High retail shorting with price absorption indicates institutional accumulation/short squeeze potential.

## Project Roadmap
- **[PHASE 1] Data Extraction (ETL):** (Completed) Fetch and clean OHLCV data via CCXT.
- **[PHASE 2] AI Lab (Edge Discovery):** (Completed) Craft system prompts and validate Gemini API responses.
- **[PHASE 3] Paper Trading (Validation):** (Current Focus) Log virtual trades, validate Short Squeeze Trap strategy, and implement Trailing Stop/Volatility filters.
- **[PHASE 4] Live Execution (Capital Protection):** Real API keys, Kill Switches (Max Daily Drawdown, Position Sizing).

## Building and Running
- `docker-compose up -d`: Start the environment.
- `docker exec quant-trader-app npx tsx src/index.ts`: Run the main bot logic.
- `docker exec quant-trader-app npx tsx src/market-intel.ts`: Fetch derivative market data.

## Key Files
- `RECAP_STRATEGY.md`: Current strategy status and performance tracking.
- `market_intel.json`: Latest derivative data snapshot.
- `src/index.ts`: Main Intelligence Controller.
- `src/market-intel.ts`: Binance Futures data fetcher.
- `project-context.md`: Comprehensive project identity and mission.
