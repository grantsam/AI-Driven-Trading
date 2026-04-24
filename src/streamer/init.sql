-- 1. Setup Extension pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Tabel Whale Trades
CREATE TABLE IF NOT EXISTS whale_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    notional DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL
);

-- 3. Tabel Liquidations
CREATE TABLE IF NOT EXISTS liquidations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL
);

-- 4. Indexing
CREATE INDEX IF NOT EXISTS idx_whale_timestamp ON whale_trades(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_liq_timestamp ON liquidations(timestamp DESC);

-- 5. pg_cron: Cleanup Data > 7 Hari (Setiap Jam 00:00)
SELECT cron.schedule(
    'cleanup-trading-data',
    '0 0 * * *',
    $$ 
    DELETE FROM whale_trades WHERE timestamp < NOW() - INTERVAL '24 hours'; 
    DELETE FROM liquidations WHERE timestamp < NOW() - INTERVAL '24 hours';
    $$
);