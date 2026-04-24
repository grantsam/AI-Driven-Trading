import { db } from '../db';
import { BinanceMarketIntel } from '../market-intel';
import { GrantAnalyst } from './analyst';
import { SyncWorker } from './sync-worker';

export class TradingService {
    private intel = new BinanceMarketIntel();
    private analyst = new GrantAnalyst();
    private syncWorker = new SyncWorker();

    /**
     * PHASE 1: Sync
     */
    async syncMarketData(symbol: string = 'BTC/USDT') {
        // Sync Micro/X-Ray data from Supabase
        await this.syncWorker.syncAll(symbol);
        
        // Sync Macro/Helicopter data from Binance
        await this.intel.syncHistory(symbol);
        return await this.intel.fetchRealData(symbol);
    }

    /**
     * PHASE 2: Quantitative Pre-processing
     */
    async prepareQuantitativeMetrics(symbol: string = 'BTC/USDT') {
        const metrics = await this.analyst.calculateMetrics(symbol);
        
        const query = `
            INSERT INTO signals (symbol, action, confidence, confluence_score, atr, vwap, oi_delta, reasoning, metadata)
            VALUES ($1, 'PRE_PROCESS', $2, $3, $4, $5, $6, $7, $8)
            RETURNING *;
        `;

        // Reasoning hanya berisi status teknis yang jujur
        const result = await db.query(query, [
            symbol, 
            Math.round(metrics.confluenceScore * 100),
            metrics.confluenceScore,
            metrics.atr14h,
            metrics.vwap24h,
            metrics.oiDelta1h,
            "STATUS: QUANT_METRICS_CALCULATED | SOURCE: SYSTEM_ENGINE",
            JSON.stringify({ metrics })
        ]);
        return result.rows[0];
    }

    /**
     * PHASE 3: AI Strategic Advice
     */
    async injectAIAdvice(symbol: string, opinion: string, verdict: 'BUY' | 'SELL' | 'HOLD', metrics: any) {
        const query = `
            INSERT INTO signals (symbol, action, confidence, confluence_score, atr, vwap, oi_delta, reasoning, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        
        const result = await db.query(query, [
            symbol, 
            verdict, 
            Math.round(metrics.confluenceScore * 100),
            metrics.confluenceScore, 
            metrics.atr14h, 
            metrics.vwap24h,
            metrics.oiDelta1h, 
            opinion || "STATUS: AI_REASONING_EMPTY | ACTION: CHECK_LLM_INTEGRATION", 
            JSON.stringify({ is_ai: true, raw_metrics: metrics })
        ]);
        return result.rows[0];
    }

    /**
     * PHASE 4: Execution
     */
    async executeTrade(symbol: string, action: 'BUY' | 'SELL', signalId?: string, leverage: number = 10) {
        // --- GATE: Prevent Layered Entry ---
        const { rows: active } = await db.query(`SELECT id FROM trades WHERE status = 'OPEN' AND symbol = $1`, [symbol]);
        if (active.length > 0) {
            throw new Error(`ENTRY_REJECTED: POSITION_ALREADY_OPEN_FOR_${symbol}`);
        }

        const metrics = await this.analyst.calculateMetrics(symbol);
        const price = metrics.currentPrice;
        
        const sl = action === 'BUY' ? price - (2 * metrics.atr14h) : price + (2 * metrics.atr14h);
        const tp = action === 'BUY' ? price + (4 * metrics.atr14h) : price - (4 * metrics.atr14h);

        const query = `
            INSERT INTO trades (
                symbol, type, leverage, entry_price, status, stop_loss, take_profit, 
                trailing_sl, highest_price, entry_oi, entry_funding, entry_vwap, signal_id
            )
            VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *;
        `;
        const result = await db.query(query, [
            symbol, action, leverage, price, sl, tp, sl, price, 
            metrics.oiDelta1h, metrics.fundingRate, metrics.vwap24h, signalId
        ]);
        return result.rows[0];
    }

    async updateSystemState(symbol: string = 'BTC/USDT') {
        const metrics = await this.analyst.calculateMetrics(symbol);
        const currentPrice = metrics.currentPrice;
        
        // 1. Get Open Positions
        const { rows: positions } = await db.query(`SELECT * FROM trades WHERE status = 'OPEN' AND symbol = $1`, [symbol]);
        if (positions.length === 0) return;

        // 2. Fetch recent market history since the oldest open trade
        const { rows: history } = await db.query(
            `SELECT high, low, close, timestamp FROM market_history WHERE symbol = $1 ORDER BY timestamp ASC`, 
            [symbol]
        );

        const TAKER_FEE = 0.0005; // 0.05%

        for (const pos of positions) {
            const entry = parseFloat(pos.entry_price);
            const leverage = parseInt(pos.leverage || '10');
            const sl = parseFloat(pos.trailing_sl || pos.stop_loss);
            const tp = parseFloat(pos.take_profit);
            let exitPrice = null;
            let exitTime = null;

            // Retroactive Scan: Check if SL/TP was hit in the historical data (while server was off)
            for (const bar of history) {
                if (new Date(bar.timestamp) <= new Date(pos.created_at)) continue;

                const high = parseFloat(bar.high);
                const low = parseFloat(bar.low);

                if (pos.type === 'BUY') {
                    if (low <= sl) { exitPrice = sl; exitTime = bar.timestamp; break; }
                    if (high >= tp) { exitPrice = tp; exitTime = bar.timestamp; break; }
                } else {
                    if (high >= sl) { exitPrice = sl; exitTime = bar.timestamp; break; }
                    if (low <= tp) { exitPrice = tp; exitTime = bar.timestamp; break; }
                }
            }

            // If found in history or hit live SL/TP
            const finalExitPrice = exitPrice || (currentPrice >= tp || currentPrice <= sl ? currentPrice : null);
            const finalExitTime = exitTime || (finalExitPrice ? new Date() : null);

            if (finalExitPrice) {
                // Calculation logic: ((Exit - Entry) / Entry) * Leverage * 100
                const priceDiffPercent = pos.type === 'BUY' 
                    ? (finalExitPrice - entry) / entry 
                    : (entry - finalExitPrice) / entry;
                
                const grossPnl = priceDiffPercent * leverage * 100;
                
                // Fees: Leverage * TakerFee * 100 (for entry) + Leverage * TakerFee * 100 (for exit)
                const entryFee = leverage * TAKER_FEE * 100;
                const exitFee = leverage * TAKER_FEE * 100;
                const totalFees = entryFee + exitFee;
                
                const netPnl = grossPnl - totalFees;

                await db.query(
                    `UPDATE trades SET exit_price = $1, pnl = $2, fees = $3, net_pnl = $4, status = 'CLOSED', closed_at = $5 WHERE id = $6`,
                    [finalExitPrice, grossPnl, totalFees, netPnl, finalExitTime, pos.id]
                );
                console.log(`[✔] Trade Closed: ${pos.id} at ${finalExitPrice} | Net PnL: ${netPnl.toFixed(2)}% (Fees: ${totalFees.toFixed(2)}%)`);
                continue;
            }

            // Standard Live Update (Trailing Stop)
            const currentPnlPercent = pos.type === 'BUY' 
                ? (currentPrice - entry) / entry 
                : (entry - currentPrice) / entry;
            
            if ((currentPnlPercent * 100) > 0.5) {
                const newSL = pos.type === 'BUY' 
                    ? currentPrice - (2.5 * metrics.atr14h)
                    : currentPrice + (2.5 * metrics.atr14h);
                
                await db.query(`
                    UPDATE trades 
                    SET highest_price = CASE WHEN type = 'BUY' THEN GREATEST(highest_price, $1) ELSE LEAST(highest_price, $1) END, 
                        trailing_sl = CASE WHEN type = 'BUY' THEN GREATEST(trailing_sl, $2) ELSE LEAST(trailing_sl, $2) END 
                    WHERE id = $3`, 
                    [currentPrice, newSL, pos.id]
                );
            }
        }
    }

    async getWinRateAudit(symbol: string = 'BTC/USDT', days: number = 7) {
        // We use a large interval or remove the date filter temporarily to ensure simulated data (2026) is captured
        // Or we can anchor it to the LATEST trade in the database instead of NOW()
        const result = await db.query(`
            SELECT 
                COUNT(*)::integer as total_trades,
                COUNT(*) FILTER (WHERE net_pnl > 0)::integer as winning_trades,
                COALESCE(AVG(pnl), 0)::numeric as avg_gross_pnl,
                COALESCE(AVG(net_pnl), 0)::numeric as avg_net_pnl,
                COALESCE(SUM(net_pnl), 0)::numeric as total_net_pnl,
                COALESCE(SUM(fees), 0)::numeric as total_fees,
                COALESCE(SUM(CASE WHEN type = 'BUY' THEN exit_price - entry_price ELSE entry_price - exit_price END), 0)::numeric as total_pnl_usd
            FROM trades 
            WHERE status = 'CLOSED' 
            AND symbol = $1 
            AND closed_at >= (SELECT MAX(closed_at) FROM trades) - ($2 || ' days')::INTERVAL
        `, [symbol, days]);

        const stats = result.rows[0];
        const total = parseInt(stats.total_trades || 0);
        const winners = parseInt(stats.winning_trades || 0);
        const winRate = total > 0 ? (winners / total) * 100 : 0;

        return {
            symbol,
            period: `${days} days`,
            totalTrades: total,
            winningTrades: winners,
            winRate: winRate.toFixed(2) + '%',
            avgGrossPnl: parseFloat(stats.avg_gross_pnl || 0).toFixed(2) + '%',
            avgNetPnl: parseFloat(stats.avg_net_pnl || 0).toFixed(2) + '%',
            totalNetPnl: parseFloat(stats.total_net_pnl || 0).toFixed(2) + '%',
            totalFees: parseFloat(stats.total_fees || 0).toFixed(2) + '%',
            totalPnlUsd: parseFloat(stats.total_pnl_usd || 0).toFixed(2)
        };
    }
}
