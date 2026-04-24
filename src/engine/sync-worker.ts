import { db, remoteDb } from '../db';

/**
 * SyncWorker (The Bridge)
 * Periodically mirrors Raw Data (Whale Trades & Liquidations) from Supabase to Local DB.
 * This ensures "The Brain" has low-latency access to Micro/X-Ray data.
 */
export class SyncWorker {
    async syncAll(symbol: string) {
        console.log(`[*] SyncWorker: Mirroring X-Ray data for ${symbol}...`);
        await Promise.all([
            this.syncWhaleTrades(symbol),
            this.syncLiquidations(symbol)
        ]);
        console.log(`[+] SyncWorker: X-Ray Mirroring complete.`);
    }

    private async syncWhaleTrades(symbol: string) {
        try {
            const symbols = [symbol, symbol.replace('/', '')];
            // Get the latest timestamp from local DB to avoid duplicate fetching
            const { rows: localLatest } = await db.query(
                `SELECT MAX(timestamp) as last_ts FROM whale_trades WHERE symbol = ANY($1)`,
                [symbols]
            );
            const lastTs = localLatest[0]?.last_ts || new Date(0).toISOString();

            // Fetch new trades from Remote (Supabase)
            const { rows: remoteTrades } = await remoteDb.query(
                `SELECT * FROM whale_trades WHERE symbol = ANY($1) AND timestamp > $2 ORDER BY timestamp ASC`,
                [symbols, lastTs]
            );

            if (remoteTrades.length === 0) return;

            console.log(`[🐳] Syncing ${remoteTrades.length} new Whale Trades...`);

            // Batch Insert to Local
            for (const t of remoteTrades) {
                await db.query(`
                    INSERT INTO whale_trades (symbol, side, price, amount, notional, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT DO NOTHING
                `, [symbol, t.side, t.price, t.amount, t.notional, t.timestamp]);
            }
        } catch (e) {
            console.error(`[!] Whale Sync Error:`, e.message);
        }
    }

    private async syncLiquidations(symbol: string) {
        try {
            const symbols = [symbol, symbol.replace('/', '')];
            // Get the latest timestamp from local DB
            const { rows: localLatest } = await db.query(
                `SELECT MAX(timestamp) as last_ts FROM liquidations WHERE symbol = ANY($1)`,
                [symbols]
            );
            const lastTs = localLatest[0]?.last_ts || new Date(0).toISOString();

            // Fetch new liquidations from Remote
            const { rows: remoteLiquidations } = await remoteDb.query(
                `SELECT * FROM liquidations WHERE symbol = ANY($1) AND timestamp > $2 ORDER BY timestamp ASC`,
                [symbols, lastTs]
            );

            if (remoteLiquidations.length === 0) return;

            console.log(`[💀] Syncing ${remoteLiquidations.length} new Liquidations...`);

            // Batch Insert to Local
            for (const l of remoteLiquidations) {
                await db.query(`
                    INSERT INTO liquidations (symbol, side, price, amount, timestamp)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT DO NOTHING
                `, [symbol, l.side, l.price, l.amount, l.timestamp]);
            }
        } catch (e) {
            console.error(`[!] Liquidation Sync Error:`, e.message);
        }
    }
}
