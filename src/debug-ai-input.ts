import { GrantAnalyst } from './engine/analyst';
import { db } from './db';

async function debugAIInput() {
    const analyst = new GrantAnalyst();
    const symbol = 'BTC/USDT';

    try {
        console.log(`[*] Fetching feeding data for ${symbol}...`);

        // 1. Get Metrics (The 'metrics' parameter)
        const metrics = await analyst.calculateMetrics(symbol);

        // 2. Get Additional Context (The 'additionalContext' parameter)
        const historyRes = await db.query(`
            SELECT close, volume 
            FROM market_history 
            WHERE symbol = $1 
            ORDER BY timestamp DESC LIMIT 2
        `, [symbol]);
        
        const latest = historyRes.rows[0];
        const previous = historyRes.rows[1];

        const context = {
            volume: latest?.volume || 0,
            prevPrice: previous?.close || latest?.close || 0
        };

        // 3. Print the "Feeding Data"
        console.log("\n=== DATA FED TO AI ADVISOR ===");
        console.log("\n[1] METRICS:");
        console.log(JSON.stringify(metrics, null, 2));
        
        console.log("\n[2] ADDITIONAL CONTEXT:");
        console.log(JSON.stringify(context, null, 2));

        process.exit(0);
    } catch (e) {
        console.error("Debug Error:", e);
        process.exit(1);
    }
}

debugAIInput();
