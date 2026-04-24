import { db } from './db';

async function checkClosedAt() {
    try {
        const { rows } = await db.query("SELECT id, symbol, status, created_at, closed_at FROM trades WHERE status = 'CLOSED' ORDER BY closed_at DESC LIMIT 10");
        console.table(rows);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
checkClosedAt();
