import ccxt from 'ccxt';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { db } from './db';

dotenv.config();

export interface BinanceIntel {
    timestamp: string;
    source: string;
    derivatives: {
        symbol: string;
        fundingRate: number;
        openInterest: number;
        markPrice: number;
    };
    sentiment: {
        longShortRatio: number;
    };
}

export class BinanceMarketIntel {
    private exchange: ccxt.binance;

    constructor() {
        this.exchange = new ccxt.binance({ 
            options: { 'defaultType': 'future' },
            enableRateLimit: true 
        });
    }

    /**
     * Syncs historical data (OHLCV + Derivatives) to Database
     */
    async syncHistory(symbol: string = 'BTC/USDT') {
        console.log(`[*] Syncing Market History (Macro) for ${symbol}...`);
        
        const symbolRaw = symbol.replace('/', '');
        try {
            // 1. Fetch OHLCV (1h, last 168 hours = 1 week)
            const ohlcv = await this.exchange.fetchOHLCV(symbol, '1h', undefined, 168);
            
            // 2. Fetch Funding Rate History
            const fundingHistory = await this.exchange.fetchFundingRateHistory(symbol, undefined, 168);

            // 3. Fetch Open Interest History (Direct API)
            const oiHistory = await (this.exchange as any).fapiDataGetOpenInterestHist({
                symbol: symbolRaw,
                period: '1h',
                limit: 168
            });

            // 4. Upsert into Database
            for (let i = 0; i < ohlcv.length; i++) {
                const [time, open, high, low, close, volume] = ohlcv[i];
                const timestamp = new Date(time).toISOString();
                
                const funding = fundingHistory.find(f => 
                    Math.abs((f.timestamp || 0) - time) < 3600000 
                );

                const oiData = oiHistory.find((o: any) => 
                    Math.abs(parseInt(o.timestamp) - time) < 3600000
                );

                await db.query(`
                    INSERT INTO market_history (
                        symbol, timestamp, open, high, low, close, volume, 
                        funding_rate, open_interest, mark_price
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    ON CONFLICT (symbol, timestamp) DO UPDATE SET
                        open = EXCLUDED.open,
                        high = EXCLUDED.high,
                        low = EXCLUDED.low,
                        close = EXCLUDED.close,
                        volume = EXCLUDED.volume,
                        funding_rate = EXCLUDED.funding_rate,
                        open_interest = EXCLUDED.open_interest,
                        mark_price = COALESCE(market_history.mark_price, EXCLUDED.mark_price);
                `, [
                    symbol, timestamp, open, high, low, close, volume,
                    funding?.fundingRate || 0,
                    parseFloat(oiData?.sumOpenInterest || '0'),
                    close 
                ]);
            }

            console.log(`[+] History Synced: ${ohlcv.length} data points saved.`);

        } catch (error) {
            console.error(`[!] History Sync Failed:`, error.message);
        }
    }

    async fetchRealData(symbol: string = 'BTC/USDT') {
        console.log(`--- BINANCE REAL-DATA PIPELINE ---`);
        const symbolRaw = symbol.replace('/', '');

        try {
            // 1. Fetch Ticker & Funding Rate
            console.log(`[*] Fetching Market Prices...`);
            const ticker = await this.exchange.fetchTicker(symbol);
            const fundingInfo = await this.exchange.fetchFundingRate(symbol);

            const lastPrice = ticker.last || 0;
            const markPrice = (fundingInfo as any).markPrice || lastPrice;

            // 2. Fetch Open Interest
            const oiResponse = await (this.exchange as any).fapiPublicGetOpenInterest({ symbol: symbolRaw });
            const finalOpenInterest = parseFloat(oiResponse.openInterest || '0');

            // 3. Fetch Long/Short Ratio
            const lsResponse = await (this.exchange as any).fapiDataGetTopLongShortAccountRatio({ 
                symbol: symbolRaw,
                period: '1h'
            });

            const currentLS = lsResponse[lsResponse.length - 1];

            const result: BinanceIntel = {
                timestamp: new Date().toISOString(),
                source: 'Binance Futures Official API',
                derivatives: {
                    symbol,
                    fundingRate: fundingInfo.fundingRate || 0,
                    openInterest: finalOpenInterest,
                    markPrice: markPrice
                },
                sentiment: {
                    longShortRatio: parseFloat(currentLS.longShortRatio || '0')
                }
            };

            // Log divergence
            const divergence = ((Math.abs(lastPrice - markPrice) / markPrice) * 100).toFixed(4);
            console.log(`[!] Price Check: Last $${lastPrice} | Mark $${markPrice} (Div: ${divergence}%)`);

            // Save snapshot
            fs.writeFileSync('./market_intel.json', JSON.stringify(result, null, 2));

            // Also save current snapshot to history table
            const date = new Date();
            date.setMinutes(0, 0, 0); 
            const hourlyTimestamp = date.toISOString();

            await db.query(`
                INSERT INTO market_history (
                    symbol, timestamp, mark_price, funding_rate, open_interest, ls_ratio
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (symbol, timestamp) DO UPDATE SET
                    mark_price = EXCLUDED.mark_price,
                    funding_rate = EXCLUDED.funding_rate,
                    open_interest = EXCLUDED.open_interest,
                    ls_ratio = EXCLUDED.ls_ratio;
            `, [
                symbol, hourlyTimestamp, result.derivatives.markPrice,
                result.derivatives.fundingRate, result.derivatives.openInterest,
                result.sentiment.longShortRatio
            ]);

            console.log(`[+] SUCCESS: Real data saved to DB and market_intel.json`);
            return result;

        } catch (error) {
            console.error(`[!] BINANCE API FAILURE:`, error.message);
            throw error;
        }
    }
}

// Only run if called directly
if (process.argv[1].endsWith('market-intel.ts')) {
    const intel = new BinanceMarketIntel();
    await intel.syncHistory();
    await intel.fetchRealData();
    process.exit(0);
}
