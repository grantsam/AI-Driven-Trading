import * as dotenv from 'dotenv';
import { db, remoteDb, setupDatabase } from './db';
import { SyncWorker } from './engine/sync-worker';

dotenv.config();

async function testPhaseA() {
    console.log('--- 🧪 TESTING PHASE A: SUPABASE BRIDGE ---');
    
    try {
        // 1. Setup Local Schema
        console.log('[1/4] Initializing local database schema...');
        await setupDatabase();

        // 2. Test Remote Connection
        console.log('[2/4] Testing connection to Supabase...');
        const remoteTest = await remoteDb.query('SELECT NOW()');
        console.log(`[✔] Remote Connected: ${remoteTest.rows[0].now}`);

        // 3. Run SyncWorker
        const symbol = 'BTC/USDT';
        const syncWorker = new SyncWorker();
        console.log(`[3/4] Running SyncWorker for ${symbol}...`);
        await syncWorker.syncAll(symbol);

        // 4. Verify Local Data
        console.log('[4/4] Verifying local data persistence...');
        
        const { rows: whaleCount } = await db.query('SELECT COUNT(*) FROM whale_trades');
        const { rows: rektCount } = await db.query('SELECT COUNT(*) FROM liquidations');

        console.log('------------------------------------------');
        console.log(`[📊] STATUS SINKRONISASI:`);
        console.log(`- Whale Trades di Lokal : ${whaleCount[0].count} baris`);
        console.log(`- Liquidations di Lokal : ${rektCount[0].count} baris`);
        console.log('------------------------------------------');

        if (parseInt(whaleCount[0].count) > 0 || parseInt(rektCount[0].count) > 0) {
            console.log('[🚀] TEST BERHASIL: Data berhasil ditarik dari Supabase!');
        } else {
            console.log('[⚠️] PERINGATAN: Koneksi sukses tapi tidak ada data baru (mungkin tabel di Supabase masih kosong).');
        }

    } catch (error) {
        console.error('[❌] TEST GAGAL:', error.message);
        if (error.message.includes('password authentication failed')) {
            console.error('>> Tips: Periksa kembali SUPABASE_DB_URL di file .env Anda.');
        } else if (error.message.includes('ECONNREFUSED')) {
            console.error('>> Tips: Pastikan IP Anda sudah di-whitelist di Dashboard Supabase atau gunakan Direct Connection.');
        }
    } finally {
        await db.end();
        await remoteDb.end();
        process.exit(0);
    }
}

testPhaseA();
