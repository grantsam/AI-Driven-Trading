import ccxt from 'ccxt';
import { Candle, MarketDataRequest } from '../types/index';

/**
 * Data Fetcher Skill (CCXT-based)
 * Responsible for retrieving and normalizing market data
 */
export class FetcherSkill {
    private exchange: ccxt.bybit;

    constructor() {
        this.exchange = new ccxt.bybit({
            enableRateLimit: true,
        });
    }

    /**
     * Executes the OHLCV data fetching process
     */
    async execute(request: MarketDataRequest): Promise<Candle[]> {
        const { symbol, timeframe, limit } = request;

        try {
            console.log(`[*] FetcherSkill: Fetching ${limit} candles for ${symbol} (${timeframe})`);
            
            const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
            
            const normalizedData: Candle[] = ohlcv.map(candle => ({
                timestamp: candle[0] as number,
                datetime: new Date(candle[0] as number).toISOString(),
                open: candle[1] as number,
                high: candle[2] as number,
                low: candle[3] as number,
                close: candle[4] as number,
                volume: candle[5] as number,
            }));

            console.log(`[+] FetcherSkill: Successfully retrieved ${normalizedData.length} candles.`);
            return normalizedData;

        } catch (error) {
            console.error(`[!] FetcherSkill Error:`, error);
            throw error;
        }
    }
}
