import * as dotenv from 'dotenv';
import { setupDatabase, db } from './db';
import { BinanceMarketIntel } from './market-intel';
import type { BinanceIntel } from './market-intel';
import { GrantAnalyst } from './engine/analyst';
import { SyncWorker } from './engine/sync-worker';

dotenv.config();

/**
 * Position Manager: Purely for Execution
 */
export class PositionManager {
    async logSignal(symbol: string, analysis: any, metrics: any): Promise<string> {
        const query = `
            INSERT INTO signals (symbol, action, confidence, confluence_score, atr, vwap, oi_delta, reasoning, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id;
        `;
        // Capture the entire metrics object into the metadata for future auditing/anomaly detection
        const metadata = {
            ...(analysis.metadata || {}),
            raw_metrics_snapshot: metrics
        };

        const values = [
            symbol, analysis.action, analysis.confidence, analysis.confluence_score,
            metrics.atr14h, metrics.vwap24h, metrics.oiDelta1h,
            analysis.reasoning, JSON.stringify(metadata)
        ];
        const result = await db.query(query, values);
        return result.rows[0].id;
    }

    async getOpenPositions(symbol: string) {
        const query = `SELECT * FROM trades WHERE symbol = $1 AND status = 'OPEN' ORDER BY created_at DESC;`;
        const result = await db.query(query, [symbol]);
        return result.rows;
    }

    async openTrade(signalId: string, symbol: string, type: 'BUY' | 'SELL', price: number, metrics: any) {
        const sl = type === 'BUY' ? price * 0.99 : price * 1.01;
        const tp = type === 'BUY' ? price * 1.02 : price * 0.98;
        const query = `
            INSERT INTO trades (
                signal_id, symbol, type, entry_price, status, 
                stop_loss, take_profit, trailing_sl, highest_price,
                entry_oi, entry_funding, entry_vwap
            )
            VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7, $8, $9, $10, $11)
        `;
        await db.query(query, [signalId, symbol, type, price, sl, tp, sl, price, metrics.oiDelta1h, metrics.fundingRate, metrics.vwap24h]);
        console.log(`[✔] EXECUTION: ${type} position opened at ${price}`);
    }

    async updateTrailingStop(tradeId: string, currentPrice: number, atr: number) {
        const newSL = currentPrice - (2.5 * atr);
        await db.query(`
            UPDATE trades 
            SET highest_price = GREATEST(highest_price, $1),
                trailing_sl = GREATEST(trailing_sl, $2)
            WHERE id = $3;
        `, [currentPrice, newSL, tradeId]);
    }

    async closeTrade(tradeId: string, exitPrice: number, pnl: number) {
        await db.query(`UPDATE trades SET exit_price = $1, pnl = $2, status = 'CLOSED', closed_at = NOW() WHERE id = $3;`, [exitPrice, pnl, tradeId]);
        console.log(`[✘] CLOSED: Trade ${tradeId} at ${exitPrice} | PnL: $${pnl.toFixed(2)}`);
    }
}

async function main() {
    // Parse CLI Arguments
    const args = process.argv.slice(2);
    const manualAction = args.find(a => a.startsWith('--action='))?.split('=')[1] as 'BUY' | 'SELL' | undefined;
    const aiOpinion = args.find(a => a.startsWith('--opinion='))?.split('=')[1];
    const mode = args.find(a => a.startsWith('--mode='))?.split('=')[1];

    console.log('--- GRANT_INTELLIGENCE TOOL ---');
    try {
        await setupDatabase();
        
        const symbol = 'BTC/USDT';
        const intelService = new BinanceMarketIntel();
        const analyst = new GrantAnalyst();
        const manager = new PositionManager();
        const syncWorker = new SyncWorker();

        // 1. SYNC DATA
        await syncWorker.syncAll(symbol);
        await intelService.syncHistory(symbol);
        const intel = await intelService.fetchRealData(symbol);
        const metrics = await analyst.calculateMetrics(symbol);
        const currentPrice = metrics.currentPrice;

        // 2. AI THOUGHT PROCESS (Mode: ANALYZE)
        if (mode === 'ANALYZE') {
            const reasoning = `[AI_CORE_THOUGHT] Confluence at ${(metrics.confluenceScore*100).toFixed(0)}%. ` +
                `Funding ${metrics.fundingRate < 0 ? 'Negative (RETAIL_SHORT)' : 'Positive'}. ` +
                `OI Delta is ${(metrics.oiDelta1h).toFixed(4)}%. ` +
                `Price is ${currentPrice > metrics.vwap24h ? 'ABOVE' : 'BELOW'} VWAP. ` +
                `Recommendation: ${metrics.confluenceScore >= 0.8 ? 'STRONG_BUY_SIGNAL' : 'WAIT_FOR_SQUEEZE'}`;

            await manager.logSignal(symbol, {
                action: 'THOUGHT',
                confidence: Math.round(metrics.confluenceScore * 100),
                confluence_score: metrics.confluenceScore,
                reasoning: reasoning,
                metadata: { is_ai: true, is_thought: true }
            }, metrics);
            
            console.log(`[🧠] AI THOUGHT GENERATED: ${reasoning}`);
            return;
        }

        // 3. MONITOR POSITIONS (Already implemented ...)
        const openPositions = await manager.getOpenPositions(symbol);
        for (const pos of openPositions) {
            const entry = parseFloat(pos.entry_price);
            const pnl = pos.type === 'BUY' ? (currentPrice - entry) : (entry - currentPrice);
            if ((pnl/entry)*100 > 0.5) await manager.updateTrailingStop(pos.id, currentPrice, metrics.atr14h);
            
            const sl = parseFloat(pos.trailing_sl || pos.stop_loss);
            const tp = parseFloat(pos.take_profit);
            if (currentPrice >= tp || currentPrice <= sl) await manager.closeTrade(pos.id, currentPrice, pnl);
        }

        // 4. LOG ACTION / OPINION
        if (manualAction || aiOpinion) {
            const signalId = await manager.logSignal(symbol, {
                action: manualAction || 'ANALYSIS',
                confidence: Math.round(metrics.confluenceScore * 100),
                confluence_score: metrics.confluenceScore,
                reasoning: aiOpinion || `Manual execution: ${manualAction}`,
                metadata: { 
                    is_ai: !!aiOpinion,
                    breakdown: {
                        funding: metrics.fundingRate < 0 ? 0.3 : 0,
                        ls_ratio: metrics.lsRatio < 1.0 ? 0.3 : 0,
                        oi_delta: metrics.oiDelta1h < 0 ? 0.2 : 0,
                        vwap: currentPrice <= metrics.vwap24h * 1.005 ? 0.2 : 0
                    }
                }
            }, metrics);
            
            if (manualAction) {
                await manager.openTrade(signalId, symbol, manualAction, currentPrice, metrics);
            }
        } else {
            // Default Passive Log
            await manager.logSignal(symbol, {
                action: 'HOLD',
                confidence: Math.round(metrics.confluenceScore * 100),
                confluence_score: metrics.confluenceScore,
                reasoning: `Passive monitoring mode. Standing by for AI/User directive.`,
                metadata: { breakdown: {
                    funding: metrics.fundingRate < 0 ? 0.3 : 0,
                    ls_ratio: metrics.lsRatio < 1.0 ? 0.3 : 0,
                    oi_delta: metrics.oiDelta1h < 0 ? 0.2 : 0,
                    vwap: currentPrice <= metrics.vwap24h * 1.005 ? 0.2 : 0
                }}
            }, metrics);
        }

    } catch (e) {
        console.error('[!] Error:', e.message);
    } finally {
        await db.end();
        process.exit(0);
    }
}

main();
