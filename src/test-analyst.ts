import * as dotenv from 'dotenv';
import { db, setupDatabase } from './db';
import { GrantAnalyst } from './engine/analyst';
import { SyncWorker } from './engine/sync-worker';
import { BinanceMarketIntel } from './market-intel';

dotenv.config();

async function testAnalyst() {
    console.log('--- 🧪 TESTING PHASE B: OPTIMIZED ANALYST (CTE) ---');
    
    try {
        await setupDatabase();
        const symbol = 'BTC/USDT';
        const syncWorker = new SyncWorker();
        const intel = new BinanceMarketIntel();
        const analyst = new GrantAnalyst();

        // 1. Pastikan data terbaru sudah ada
        console.log('[1/3] Refreshing Macro & Micro Data...');
        await syncWorker.syncAll(symbol);
        await intel.syncHistory(symbol);
        await intel.fetchRealData(symbol);

        // 2. Jalankan Kalkulasi dengan Single Query CTE
        console.log('[2/3] Executing Optimized Batch Query (CTE)...');
        const start = Date.now();
        const metrics = await analyst.calculateMetrics(symbol);
        const duration = Date.now() - start;

        // 3. Tampilkan Hasil
        console.log('[3/3] Analysis Results:');
        console.log('------------------------------------------');
        console.log(`📊 MARKET STATUS: ${metrics.symbol} @ $${metrics.currentPrice}`);
        console.log(`⏱️  Query Speed  : ${duration}ms (Single Batch)`);
        console.log('------------------------------------------');
        console.log(`🐳 WAS (Whale Aggression) : ${metrics.whaleAggressionScore.toFixed(4)}`);
        console.log(`💀 LEI (Exhaustion Index) : ${metrics.liquidityExhaustionIndex.toFixed(2)}`);
        console.log(`📈 Z-Score Intensity      : ${metrics.whaleIntensityZScore.toFixed(2)}`);
        console.log(`🧽 Absorption Detected    : ${metrics.isAbsorption ? '✅ YES' : '❌ NO'}`);
        console.log(`🌊 Whale CVD (24h)        : $${(metrics.whaleCvd24h/1000000).toFixed(2)}M`);
        console.log(`🎯 Confluence Score       : ${(metrics.confluenceScore * 100).toFixed(0)}%`);
        console.log('------------------------------------------');

        if (metrics.confluenceScore > 0) {
            console.log('[🚀] TEST BERHASIL: Brain Analyst berfungsi dengan Single Batch Query!');
        }

    } catch (error) {
        console.error('[❌] TEST ANALYST GAGAL:', error.message);
        console.error(error.stack);
    } finally {
        await db.end();
        process.exit(0);
    }
}

testAnalyst();
