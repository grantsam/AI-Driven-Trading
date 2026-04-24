import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || (process.env.NODE_ENV === 'development' ? 'db' : 'localhost'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'quant_trader',
    port: parseInt(process.env.DB_PORT || '5432'),
});

// Remote Pool (Supabase - Optimized for Session Pooler)
const remotePool = new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { 
        rejectUnauthorized: false
    },
    max: 10, // Limit connections to pooler
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

export const db = {
    query: (text: string, params?: any[]) => pool.query(text, params),
    end: () => pool.end(),
};

export const remoteDb = {
    query: (text: string, params?: any[]) => remotePool.query(text, params),
    end: () => remotePool.end(),
};

/**
 * Initializes Database Schema
 * Uses UUID v4 for primary keys as per protocol
 */
export async function setupDatabase() {
    try {
        console.log('[*] Database: Initializing schema...');
        
        // Enable UUID Extension
        await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

        // Market History: Persisting OHLCV + Derivatives for Delta/VWAP calculation
        await db.query(`
            CREATE TABLE IF NOT EXISTS market_history (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                symbol VARCHAR(20) NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                open DECIMAL,
                high DECIMAL,
                low DECIMAL,
                close DECIMAL,
                volume DECIMAL,
                open_interest DECIMAL,
                funding_rate DECIMAL,
                mark_price DECIMAL,
                ls_ratio DECIMAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, timestamp)
            );
        `);

        // Signals Table: Logs AI reasoning and Confluence Scores
        await db.query(`
            CREATE TABLE IF NOT EXISTS signals (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                symbol VARCHAR(20) NOT NULL,
                action VARCHAR(20) NOT NULL,
                confidence INTEGER NOT NULL,
                confluence_score DECIMAL,
                atr DECIMAL,
                vwap DECIMAL,
                oi_delta DECIMAL,
                reasoning TEXT,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Trades Table: Virtual Execution with Trailing Stop
        await db.query(`
            CREATE TABLE IF NOT EXISTS trades (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                signal_id UUID REFERENCES signals(id),
                symbol VARCHAR(20) NOT NULL,
                type VARCHAR(10) NOT NULL, -- 'BUY' | 'SELL'
                leverage INTEGER DEFAULT 1, -- Added for futures simulation
                entry_price DECIMAL NOT NULL,
                exit_price DECIMAL,
                stop_loss DECIMAL,
                take_profit DECIMAL,
                trailing_sl DECIMAL, -- Dynamic Stop Loss
                highest_price DECIMAL, -- Tracking for Trailing logic
                entry_vwap DECIMAL,
                entry_oi DECIMAL,
                entry_funding DECIMAL,
                pnl DECIMAL DEFAULT 0,
                fees DECIMAL DEFAULT 0,
                net_pnl DECIMAL DEFAULT 0,
                status VARCHAR(20) DEFAULT 'OPEN', -- 'OPEN' | 'CLOSED'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                closed_at TIMESTAMP
            );
        `);

        // Liquidations Table (Rekt Data)
        await db.query(`
            CREATE TABLE IF NOT EXISTS liquidations (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                symbol VARCHAR(20) NOT NULL,
                side VARCHAR(10) NOT NULL, -- 'buy' | 'sell'
                price DECIMAL NOT NULL,
                amount DECIMAL NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Whale Trades Table (High Volume Market Orders)
        await db.query(`
            CREATE TABLE IF NOT EXISTS whale_trades (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                symbol VARCHAR(20) NOT NULL,
                side VARCHAR(10) NOT NULL,
                price DECIMAL NOT NULL,
                amount DECIMAL NOT NULL,
                notional DECIMAL NOT NULL, -- amount * price
                timestamp TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // Add Missing Columns Migration (Safety)
        const migrationQueries = [
            `ALTER TABLE signals ALTER COLUMN action TYPE VARCHAR(20);`,
            `ALTER TABLE signals ADD COLUMN IF NOT EXISTS confluence_score DECIMAL;`,
            `ALTER TABLE signals ADD COLUMN IF NOT EXISTS atr DECIMAL;`,
            `ALTER TABLE signals ADD COLUMN IF NOT EXISTS vwap DECIMAL;`,
            `ALTER TABLE signals ADD COLUMN IF NOT EXISTS oi_delta DECIMAL;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS leverage INTEGER DEFAULT 1;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS trailing_sl DECIMAL;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS highest_price DECIMAL;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_vwap DECIMAL;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_oi DECIMAL;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_funding DECIMAL;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS fees DECIMAL DEFAULT 0;`,
            `ALTER TABLE trades ADD COLUMN IF NOT EXISTS net_pnl DECIMAL DEFAULT 0;`
        ];

        for (const query of migrationQueries) {
            await db.query(query);
        }

        console.log('[+] Database: Schema ready.');
    } catch (error) {
        console.error('[!] Database Init Error:', error);
        throw error;
    }
}
