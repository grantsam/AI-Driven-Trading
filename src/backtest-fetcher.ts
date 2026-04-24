import ccxt from 'ccxt';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

export class FetcherSkill {
    private exchange: ccxt.bybit;

    constructor() {
        this.exchange = new ccxt.bybit({ enableRateLimit: true });
    }

    async execute(symbol: string, timeframe: string, limit: number): Promise<any[]> {
        try {
            console.log(`[*] Backtester: Fetching ${limit} candles for ${symbol} (${timeframe})...`);
            const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
            return ohlcv.map(candle => ({
                timestamp: candle[0],
                datetime: new Date(candle[0]).toISOString(),
                open: candle[1],
                high: candle[2],
                low: candle[3],
                close: candle[4],
                volume: candle[5],
            }));
        } catch (error) {
            console.error(`[!] Fetcher Error:`, error);
            throw error;
        }
    }
}

async function main() {
    console.log('--- OPENCLAW BACKTEST DATA EXPORTER ---');
    const fetcher = new FetcherSkill();

    try {
        const symbol = 'BTC/USDT';
        const marketData = await fetcher.execute(symbol, '1h', 500);
        
        const filePath = './backtest_data.json';
        fs.writeFileSync(filePath, JSON.stringify(marketData, null, 2));
        
        console.log(`[+] Success! Backtest data saved to ${filePath} (${marketData.length} candles).`);
    } catch (error) {
        console.error('[!] Failed to export backtest data:', error);
    }
}

main();
