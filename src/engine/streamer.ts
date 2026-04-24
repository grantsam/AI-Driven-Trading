import ccxt from 'ccxt';
import { remoteDb } from '../db';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Cloud Streamer (v3.1) - The "Eyes" in the Sky
 * Streams Whale Trades & Liquidations directly to Supabase
 */
export class InstitutionalStreamer {
    private binance: any;
    private symbol: string = 'BTC/USDT';
    private isActive: boolean = false;

    constructor() {
        this.binance = new (ccxt as any).pro.binance({
            options: { 'defaultType': 'future' },
            enableRateLimit: true
        });
    }

    async start() {
        if (this.isActive) return;
        this.isActive = true;
        console.log(`[🌩️] Cloud Streamer: Activated for ${this.symbol}`);

        // Launch concurrent streams
        await Promise.all([
            this.watchWhaleTrades(),
            this.watchRektEvents(),
            this.autoPruning() // Clean up every hour
        ]);
    }

    private async watchWhaleTrades() {
        const whaleThreshold = 50000;
        while (this.isActive) {
            try {
                const trades = await this.binance.watchTrades(this.symbol);
                for (const t of trades) {
                    const notional = t.amount * t.price;
                    if (notional >= whaleThreshold) {
                        await remoteDb.query(`
                            INSERT INTO whale_trades (symbol, side, price, amount, notional, timestamp)
                            VALUES ($1, $2, $3, $4, $5, $6)
                        `, [this.symbol, t.side, t.price, t.amount, notional, new Date(t.timestamp).toISOString()]);
                        console.log(`[🐳] WHALE: $${notional.toLocaleString()}`);
                    }
                }
            } catch (e) {
                console.error(`[!] Streamer Error:`, e.message);
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    private async watchRektEvents() {
        while (this.isActive) {
            try {
                const rekts = await this.binance.watchLiquidations(this.symbol);
                for (const l of rekts) {
                    await remoteDb.query(`
                        INSERT INTO liquidations (symbol, side, price, amount, timestamp)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [this.symbol, l.side.toLowerCase() === 'sell' ? 'buy' : 'sell', l.price, l.amount, new Date(l.timestamp).toISOString()]);
                    console.log(`[💀] REKT: $${(l.amount * l.price).toLocaleString()}`);
                }
            } catch (e) {
                if (!e.message.includes('not supported')) {
                    console.error(`[!] Rekt Stream Error:`, e.message);
                }
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }

    private async autoPruning() {
        while (this.isActive) {
            try {
                console.log(`[*] Pruning Cloud DB (keeping last 24h)...`);
                await remoteDb.query(`DELETE FROM whale_trades WHERE created_at < NOW() - INTERVAL '24 hours'`);
                await remoteDb.query(`DELETE FROM liquidations WHERE created_at < NOW() - INTERVAL '24 hours'`);
                await new Promise(r => setTimeout(r, 3600000)); // Run every hour
            } catch (e) {
                console.error(`[!] Pruning Error:`, e.message);
            }
        }
    }
}
