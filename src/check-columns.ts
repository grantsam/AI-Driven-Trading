import { db } from './db';

async function check() {
    try {
        const r = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'signals'");
        console.log(r.rows.map(row => row.column_name));
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
check();
