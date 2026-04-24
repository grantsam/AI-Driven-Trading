import { db } from './db';

async function check() {
    try {
        const r1 = await db.query('SELECT count(*), MAX(timestamp) as latest FROM market_history');
        const r2 = await db.query('SELECT count(*), MAX(timestamp) as latest FROM whale_trades');
        const r3 = await db.query('SELECT count(*), MAX(timestamp) as latest FROM liquidations');
        console.log(JSON.stringify({
            market_history: r1.rows[0],
            whale_trades: r2.rows[0],
            liquidations: r3.rows[0],
            now: new Date().toISOString()
        }, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
check();
