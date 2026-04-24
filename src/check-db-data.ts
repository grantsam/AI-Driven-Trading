import { db } from './db';

async function postMortem() {
    try {
        const query = `
            SELECT 
                t.id as trade_id,
                t.symbol,
                t.type,
                t.entry_price,
                t.exit_price,
                t.net_pnl,
                s.confluence_score,
                s.reasoning,
                s.metadata->'raw_metrics_snapshot' as metrics,
                t.created_at
            FROM trades t
            JOIN signals s ON t.signal_id = s.id
            WHERE t.status = 'CLOSED' AND t.net_pnl < 0
            ORDER BY t.created_at DESC
            LIMIT 3;
        `;
        const { rows } = await db.query(query);
        
        if (rows.length === 0) {
            console.log("[-] No failed trades found for analysis.");
            process.exit(0);
        }

        console.log("=== PhD POST-MORTEM: ANALYSIS OF FAILED ENTRIES ===\n");

        rows.forEach((trade, i) => {
            console.log(`[FAILED TRADE #${i+1}] ID: ${trade.trade_id}`);
            console.log(`Result: ${trade.net_pnl}% | Type: ${trade.type} @ ${trade.entry_price}`);
            console.log(`Engine Confidence: ${trade.confluence_score}`);
            
            if (trade.metrics) {
                const m = trade.metrics;
                console.log("--- Critical Metrics at Entry ---");
                console.log(`  - Funding Rate: ${m.fundingRate}`);
                console.log(`  - L/S Ratio: ${m.lsRatio}`);
                console.log(`  - VWAP Deviation: ${m.vwapDeviation}%`);
                console.log(`  - Whale Aggression (WAS): ${m.whaleAggressionScore}`);
                console.log(`  - OI Delta (1h): ${m.oiDelta1h}%`);
            } else {
                console.log("--- (No Raw Metrics Snapshot available for this old trade) ---");
            }
            
            console.log(`\nAI Reasoning: ${trade.reasoning}`);
            console.log("\n" + "=".repeat(50) + "\n");
        });

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
postMortem();
