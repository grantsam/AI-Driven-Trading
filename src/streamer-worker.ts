import { InstitutionalStreamer } from './engine/streamer';
import express from 'express';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * WEB-READY STREAMER WORKER (Render/Koyeb Free Tier Friendly)
 */
async function startWorker() {
    const app = express();
    const port = process.env.PORT || 3000;

    // 1. A simple endpoint to keep the service "alive"
    app.get('/', (req, res) => {
        res.send('🚀 OPENCLAW X-RAY STREAMER IS ACTIVE 24/7');
    });

    app.get('/health', (req, res) => {
        res.json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
    });

    app.listen(port, () => {
        console.log(`[🌐] Keep-Alive Server active on port ${port}`);
    });

    console.log("==========================================");
    console.log("🚀 OPENCLAW X-RAY STREAMER STARTING...");
    console.log("📡 Target: Binance Futures (BTC/USDT)");
    console.log("☁️  Destination: Supabase Cloud DB");
    console.log("==========================================");

    if (!process.env.SUPABASE_DB_URL) {
        console.error("[❌] ERROR: SUPABASE_DB_URL not found in .env");
        process.exit(1);
    }

    try {
        const streamer = new InstitutionalStreamer();
        await streamer.start();

        process.on('SIGINT', () => {
            console.log("\n[🛑] Stopping Worker...");
            streamer.stop();
            process.exit(0);
        });

    } catch (error) {
        console.error("[💥] FATAL ERROR:", error.message);
        setTimeout(() => process.exit(1), 5000);
    }
}

startWorker();
