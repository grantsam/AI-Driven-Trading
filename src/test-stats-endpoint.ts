import { TradingService } from './engine/trading-service';

async function testStats() {
    const ts = new TradingService();
    try {
        console.log("Testing getWinRateAudit for BTC/USDT...");
        const stats = await ts.getWinRateAudit('BTC/USDT', 7);
        console.log("RESULT:", JSON.stringify(stats, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
testStats();
