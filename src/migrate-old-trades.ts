import { db } from './db';

async function migrate() {
    console.log('[*] Memulai migrasi data trade lama...');
    
    // 1. Ambil semua trade yang statusnya CLOSED
    const { rows: trades } = await db.query("SELECT * FROM trades WHERE status = 'CLOSED'");
    
    const TAKER_FEE = 0.0005; // 0.05%

    for (const t of trades) {
        const entry = parseFloat(t.entry_price);
        const exit = parseFloat(t.exit_price);
        const leverage = 10; // Kita asumsikan 10x untuk simulasi data lama
        
        if (!exit) continue;

        // Hitung Gross PnL %
        const priceDiffPercent = t.type === 'BUY' 
            ? (exit - entry) / entry 
            : (entry - exit) / entry;
        
        const grossPnl = priceDiffPercent * leverage * 100;
        
        // Hitung Fees % (Round-trip)
        const totalFees = leverage * TAKER_FEE * 100 * 2;
        const netPnl = grossPnl - totalFees;

        // 2. Update record di Database
        await db.query(
            `UPDATE trades SET leverage = $1, pnl = $2, fees = $3, net_pnl = $4 WHERE id = $5`,
            [leverage, grossPnl, totalFees, netPnl, t.id]
        );
        
        console.log(`[✔] Migrated Trade ${t.id}: Net PnL ${netPnl.toFixed(2)}%`);
    }

    console.log('[+] Migrasi selesai. Silakan cek Dashboard.');
    process.exit(0);
}

migrate().catch(console.error);
