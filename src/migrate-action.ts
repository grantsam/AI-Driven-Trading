import { db } from './db';

async function migrate() {
    try {
        await db.query('ALTER TABLE signals ALTER COLUMN action TYPE VARCHAR(20)');
        console.log('[✔] Migration: action column increased to VARCHAR(20)');
    } catch (e) {
        console.error('[!] Migration failed:', e);
    } finally {
        process.exit(0);
    }
}
migrate();
