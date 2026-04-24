# 🦅 AI Drive Trading System

[![Project Status: Phase 3](https://img.shields.io/badge/Status-Phase%203%20(Paper%20Trading)-orange.svg)](https://github.com/grantsam/AI-Driven-Trading)
[![Runtime: Node.js v22](https://img.shields.io/badge/Runtime-Node.js%20v22-green.svg)](https://nodejs.org/)
[![AI: Gemini 1.5](https://img.shields.io/badge/AI-Gemini%201.5%20Flash-blue.svg)](https://ai.google.dev/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

**AI Drive Trading System** is a high-frequency financial engine designed for automated cryptocurrency trading. It separates market intelligence from execution logic by using the **Gemini AI API** as a "Signal Analyst" and a strict **Node.js** backend as the "Risk Manager."

---

## 🎯 Project Mission & Principles

1.  **Capital Preservation First:** Alpha generation is secondary; the primary goal is managing downside risk.
2.  **Deterministic Intelligence:** AI prompts are zero-shot optimized to return strict, machine-readable JSON.
3.  **Microstructure Edge:** Focuses on "Institutional Traces" like **Whale Aggression Scores (WAS)**, **VWAP/POC Anchors**, and **Liquidity Absorption**.
4.  **Deterministic Execution:** No trade is executed without satisfying strict confluence and risk-to-reward (R:R) criteria.

---

## 🏗️ Technical Architecture

-   **Runtime:** Node.js v22.x (TypeScript)
-   **AI Core:** Google Gemini 1.5 (Flash/Pro) via OpenClaw framework.
-   **Market Data:** CCXT (RESTful polling for stability).
-   **Database:** PostgreSQL (with UUID v4 primary keys).
-   **Infrastructure:** Fully Dockerized for deployment on Linux VPS.
-   **Dashboard:** React-based real-time command center.

---

## 🚀 Roadmap (Phase-Based Development)

-   [x] **[PHASE 1] Data Extraction (ETL):** Reliable fetching and cleaning of OHLCV data.
-   [x] **[PHASE 2] AI Lab (Edge Discovery):** Validating signal accuracy with Gemini reasoning.
-   [➡️] **[PHASE 3] Paper Trading (Current):** Virtual execution, win-rate logging, and trailing stop validation.
-   [ ] **[PHASE 4] Live Execution:** Real API integration with hardware kill-switches.

---

## 🛠️ Quick Start

### 1. Prerequisites
-   Docker & Docker Compose
-   Google AI Studio API Key (Gemini)

### 2. Configuration
Copy the example environment file and fill in your credentials:
```bash
cp .env.example .env
```

### 3. Launching the System
Start the database and application containers:
```bash
docker-compose up -d
```

### 4. Running Scripts
Execute the main intelligence controller or market fetcher:
```bash
# Run main bot logic
docker exec quant-trader-app npx tsx src/index.ts

# Fetch derivative market data
docker exec quant-trader-app npx tsx src/market-intel.ts
```

---

## 📊 Core Metrics (Quant Foundation)

The system evaluates the market through four primary pillars:
-   **Market Anchors:** VWAP 24h & Point of Control (POC).
-   **Whale DNA:** Whale Aggression Score (WAS) & intensity Z-Scores.
-   **Liquidity Pain:** Liquidity Exhaustion Index (LEI) & Absorption Detection.
-   **Sentiment Dynamics:** Funding Rates & Top Traders L/S Ratios.

---

## ⚠️ Security Notice

-   **Never commit `.env` files.**
-   This project is currently in **Phase 3 (Paper Trading)**. Do not connect real exchange API keys with write permissions until Phase 4 validation is complete.

---
*Developed by @grantsam with Gemini CLI*
