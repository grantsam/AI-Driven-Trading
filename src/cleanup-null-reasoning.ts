import { db } from './db';

async function cleanup() {
    try {
        console.log('[*] Cleaning up trades with null reasoning...');
        
        // Delete trades where the associated signal has null reasoning OR signal_id is null
        const deleteTradesQuery = `
            DELETE FROM trades 
            WHERE signal_id IS NULL 
               OR signal_id IN (SELECT id FROM signals WHERE reasoning IS NULL);
        `;
        const resTrades = await db.query(deleteTradesQuery);
        console.log(`[+] Deleted ${resTrades.rowCount} trades.`);

        // Also cleanup orphan signals with null reasoning
        const deleteSignalsQuery = `DELETE FROM signals WHERE reasoning IS NULL;`;
        const resSignals = await db.query(deleteSignalsQuery);
        console.log(`[+] Deleted ${resSignals.rowCount} signals.`);

        process.exit(0);
    } catch (e) {
        console.error('[!] Cleanup failed:', e);
        process.exit(1);
    }
}

cleanup();
