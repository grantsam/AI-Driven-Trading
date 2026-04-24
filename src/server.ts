import express from 'express';
import cors from 'cors';
import { db, setupDatabase } from './db';
import { TradingService } from './engine/trading-service';
import { AIStrategicAdvisor } from './engine/ai-analyst';
import { GrantAnalyst } from './engine/analyst';

const app = express();
const port = 3000;
const tradingService = new TradingService();
const aiAdvisor = new AIStrategicAdvisor();
const analyst = new GrantAnalyst();

app.use(cors());
app.use(express.json());

setupDatabase().then(() => console.log('[✔] DB Ready'));

// --- DATA ENDPOINTS ---
app.get('/api/market/history', async (req, res) => {
    const result = await db.query(`SELECT * FROM market_history ORDER BY timestamp DESC LIMIT 48`);
    res.json(result.rows);
});

app.get('/api/market/analyst', async (req, res) => {
    try {
        const metrics = await analyst.calculateMetrics('BTC/USDT');
        res.json(metrics);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/market/latest', async (req, res) => {
    const result = await db.query(`SELECT * FROM market_history ORDER BY timestamp DESC LIMIT 1`);
    res.json(result.rows[0] || {});
});

app.get('/api/positions/active', async (req, res) => {
    const result = await db.query(`SELECT * FROM trades WHERE status = 'OPEN' ORDER BY created_at DESC`);
    res.json(result.rows);
});

app.get('/api/trades/history', async (req, res) => {
    const result = await db.query(`
        SELECT t.*, s.reasoning as ai_reasoning, s.action as ai_verdict
        FROM trades t
        LEFT JOIN signals s ON t.signal_id = s.id
        WHERE t.status = 'CLOSED'
        ORDER BY t.closed_at DESC
    `);
    res.json(result.rows);
});

app.get('/api/trades/stats', async (req, res) => {
    try {
        const stats = await tradingService.getWinRateAudit('BTC/USDT', 7);
        res.json(stats);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/api/trades/pnl-series', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT closed_at as time, 
                   SUM(net_pnl) OVER (ORDER BY closed_at) as cumulative_pnl
            FROM trades 
            WHERE status = 'CLOSED' AND symbol = 'BTC/USDT'
            ORDER BY closed_at ASC
        `);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: (e as Error).message });
    }
});

app.get('/api/signals/recent', async (req, res) => {
    const result = await db.query(`SELECT * FROM signals ORDER BY created_at DESC LIMIT 15`);
    res.json(result.rows);
});

// --- WORKFLOW ENDPOINTS ---

app.post('/api/workflow/sync', async (req, res) => {
    try {
        await tradingService.syncMarketData();
        await tradingService.updateSystemState();
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/workflow/prep', async (req, res) => {
    try {
        const prep = await tradingService.prepareQuantitativeMetrics();
        res.json({ success: true, prep });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/workflow/advise', async (req, res) => {
    try {
        console.log('[🧠] Workflow: Calling AI with Rich Context...');
        
        // 1. Get Metrics
        const metrics = await analyst.calculateMetrics('BTC/USDT');
        
        // 2. Get Additional Context (Volume & Prev Price) from DB
        const historyRes = await db.query(`SELECT close, volume FROM market_history WHERE symbol = 'BTC/USDT' ORDER BY timestamp DESC LIMIT 2`);
        const latest = historyRes.rows[0];
        const previous = historyRes.rows[1];

        const context = {
            volume: latest?.volume || 0,
            prevPrice: previous?.close || latest?.close || 0
        };
        
        // 3. Call AI with Full Context
        const aiResponse = await aiAdvisor.getStrategicAdvice(metrics, context);
        
        // 4. Save
        const advice = await tradingService.injectAIAdvice('BTC/USDT', aiResponse.reasoning, aiResponse.verdict, metrics);
        
        res.json({ success: true, advice });
    } catch (e) { 
        console.error("AI Error:", e);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/api/workflow/execute', async (req, res) => {
    const { action } = req.body;
    try {
        // Fetch latest signal to link
        const signalRes = await db.query(`SELECT id FROM signals WHERE symbol = 'BTC/USDT' AND action IN ('BUY', 'SELL') ORDER BY created_at DESC LIMIT 1`);
        const signalId = signalRes.rows[0]?.id;
        
        const trade = await tradingService.executeTrade('BTC/USDT', action, signalId);
        res.json({ success: true, trade });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`[🚀] GRANT_INTELLIGENCE RICH-AI API ACTIVE ON PORT ${port}`);
});
