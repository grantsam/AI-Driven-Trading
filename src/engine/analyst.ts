import { db } from '../db';

export type MarketState = 'NEUTRAL' | 'ORGANIC_ACCUMULATION' | 'ORGANIC_DISTRIBUTION' | 'SHORT_SQUEEZE' | 'LONG_UNWINDING';
export type DivergenceState = 'NONE' | 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE';

export interface InstitutionalMetrics {
    symbol: string;
    currentPrice: number;
    marketState: MarketState;
    cvdDivergence: DivergenceState;
    // 1. VWAP & POC Pillar
    vwap24h: number;
    vwapDeviation: number; 
    pocPrice: number; 
    pocProximity: number; 
    // 2. The Intent (Microstructure)
    whaleAggressionScore: number; 
    liquidityPainIndex5m: number; 
    liquidityExhaustionIndex: number; 
    whaleIntensityZScore: number; 
    isAbsorption: boolean;
    // 3. Flow & Sentiment
    whaleCvd24h: number; 
    relativeRekt24h: number; 
    oiDelta24h: number; 
    oiDelta1h: number;
    fundingRate: number;
    lsRatio: number;
    confluenceScore: number;
    // 4. Diagnostic Metrics (The "Sanity" Check)
    diagnostics: {
        whaleCount15m: number;
        rektCount15m: number;
        lastDataUpdate: string;
        isStale: boolean;
    };
    atr14h: number;
}

export class GrantAnalyst {
    async calculateMetrics(symbol: string): Promise<InstitutionalMetrics> {
        const bigQuery = `
            WITH whales AS (
                SELECT 
                    COUNT(CASE WHEN timestamp >= NOW() - INTERVAL '15 minutes' THEN 1 ELSE NULL END) as w_count_15m,
                    COALESCE(SUM(CASE WHEN timestamp >= NOW() - INTERVAL '15 minutes' AND side = 'buy' 
                        THEN notional * (1 - (EXTRACT(EPOCH FROM (NOW() - timestamp)) / 900)) ELSE 0 END), 0) as w_buy_15m,

                    COALESCE(SUM(CASE WHEN timestamp >= NOW() - INTERVAL '15 minutes' AND side = 'sell' 
                        THEN notional * (1 - (EXTRACT(EPOCH FROM (NOW() - timestamp)) / 900)) ELSE 0 END), 0) as w_sell_15m,
                    MAX(timestamp) as last_whale_ts,
                    MAX(CASE WHEN timestamp >= NOW() - INTERVAL '15 minutes' THEN price ELSE NULL END) as high_15m,
                    MIN(CASE WHEN timestamp >= NOW() - INTERVAL '15 minutes' THEN price ELSE NULL END) as low_15m,
                    COALESCE(SUM(CASE WHEN side = 'buy' THEN notional ELSE 0 END), 0) as buy_24h,
                    COALESCE(SUM(CASE WHEN side = 'sell' THEN notional ELSE 0 END), 0) as sell_24h,
                    COALESCE(SUM(notional), 0) as vol_24h,
                    COALESCE(SUM(CASE WHEN timestamp >= NOW() - INTERVAL '15 minutes' THEN notional ELSE 0 END), 0) as raw_vol_15m
                FROM whale_trades 
                WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
            ),
            rekts AS (
                SELECT 
                    COUNT(*) as r_count_15m,
                    COALESCE(SUM(CASE WHEN timestamp >= NOW() - INTERVAL '5 minutes' THEN amount * price ELSE 0 END), 0) as rekt_5m,
                    COALESCE(SUM(CASE WHEN timestamp >= NOW() - INTERVAL '15 minutes' 
                        THEN (amount * price) * (1 - (EXTRACT(EPOCH FROM (NOW() - timestamp)) / 900)) ELSE 0 END), 0) as w_rekt_15m,
                    COALESCE(SUM(amount * price), 0) as rekt_24h,
                    COALESCE((SELECT AVG(b_rekt) FROM (
                        SELECT SUM(amount * price) as b_rekt 
                        FROM liquidations 
                        WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '24 hours'
                        GROUP BY floor(extract(epoch from timestamp) / 900)
                    ) r), 0) as avg_15m_rekt
                FROM liquidations 
                WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '15 minutes'
            ),
            whale_stats AS (
                SELECT 
                    COALESCE(AVG(block_vol), 0) as avg_15m_vol, 
                    COALESCE(STDDEV(block_vol), 0) as stddev_15m_vol
                FROM (
                    SELECT floor(extract(epoch from timestamp) / 900) as block, SUM(notional) as block_vol
                    FROM whale_trades WHERE symbol = $1 AND timestamp >= NOW() - INTERVAL '24 hours' GROUP BY block
                ) b
            ),
            macro AS (
                SELECT * FROM market_history WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 96
            )
            SELECT 
                (SELECT json_agg(macro.*) FROM macro) as macro_json,
                whales.*, rekts.*, whale_stats.*
            FROM whales, rekts, whale_stats;
        `;

        const { rows } = await db.query(bigQuery, [symbol]);
        const result = rows[0];
        const macroData = result.macro_json || [];

        if (macroData.length < 2) throw new Error('Insufficient historical data');

        const latest = macroData[0];
        const currentPrice = parseFloat(latest.mark_price || latest.close || '0');
        const price24hAgo = parseFloat(macroData[macroData.length - 1].mark_price || macroData[macroData.length - 1].close || '0');

        // ATR Calculation (PhD Optimized: 14-period Rolling Average)
        // Provides a much more stable volatility anchor for SL/TP placement
        const atrData = macroData.slice(0, 14);
        const atr14h = atrData.reduce((acc, bar) => {
            const h = parseFloat(bar.high || bar.mark_price || '0');
            const l = parseFloat(bar.low || bar.mark_price || '0');
            return acc + Math.abs(h - l);
        }, 0) / (atrData.length || 1);

        // --- 1. VWAP & POC ---
        let totalTypicalPriceVolume = 0, totalVolume = 0;
        const vwapData = macroData.slice(0, 24);
        vwapData.forEach((row: any) => {
            const h = parseFloat(row.high || row.mark_price || '0'), l = parseFloat(row.low || row.mark_price || '0'), c = parseFloat(row.close || row.mark_price || '0');
            const vol = parseFloat(row.volume || '0');
            totalTypicalPriceVolume += ((h + l + c) / 3) * vol;
            totalVolume += vol;
        });
        const vwap24h = totalVolume > 0 ? totalTypicalPriceVolume / totalVolume : currentPrice;
        const stdDev = Math.sqrt(vwapData.reduce((acc, r) => acc + Math.pow(parseFloat(r.close || r.mark_price || '0') - vwap24h, 2), 0) / (vwapData.length || 1));

        const binSize = Math.max(currentPrice * 0.0005, 0.01);
        const bins: Record<number, number> = {};
        macroData.slice(0, 24).forEach(r => {
            const b = Math.floor(parseFloat(r.close || r.mark_price || '0') / binSize) * binSize;
            bins[b] = (bins[b] || 0) + parseFloat(r.volume || '0');
        });
        const pocPrice = parseFloat(Object.keys(bins).reduce((a, b) => bins[Number(a)] > bins[Number(b)] ? a : b, currentPrice.toString()));

        // --- 2. Intent & Flow ---
        const wBuy15m = parseFloat(result.w_buy_15m || '0'), wSell15m = parseFloat(result.w_sell_15m || '0');
        const was = (wBuy15m + wSell15m) > 0 ? (wBuy15m - wSell15m) / (wBuy15m + wSell15m) : 0;
        const whaleCvd24h = parseFloat(result.buy_24h || '0') - parseFloat(result.sell_24h || '0');

        const currentOI = parseFloat(latest.open_interest || '0'), prevOI = parseFloat(macroData[1]?.open_interest || '0');
        const oi24hAgo = parseFloat(macroData[macroData.length - 1]?.open_interest || '0');
        const oiDelta24h = oi24hAgo > 0 ? ((currentOI - oi24hAgo) / oi24hAgo) * 100 : 0;
        const oiDelta1h = prevOI > 0 ? ((currentOI - prevOI) / prevOI) * 100 : 0;

        // Divergence Logic
        let cvdDivergence: DivergenceState = 'NONE';
        const priceChange24h = price24hAgo > 0 ? (currentPrice - price24hAgo) / price24hAgo : 0;
        if (priceChange24h < -0.01 && whaleCvd24h > 1000000) cvdDivergence = 'BULLISH_DIVERGENCE';
        if (priceChange24h > 0.01 && whaleCvd24h < -1000000) cvdDivergence = 'BEARISH_DIVERGENCE';

        let marketState: MarketState = 'NEUTRAL';
        if (was > 0.4) marketState = oiDelta1h < -0.1 ? 'SHORT_SQUEEZE' : 'ORGANIC_ACCUMULATION';
        if (was < -0.4) marketState = oiDelta1h < -0.1 ? 'LONG_UNWINDING' : 'ORGANIC_DISTRIBUTION';

        // --- 3. Absorption & Pain ---
        const wRekt15m = parseFloat(result.w_rekt_15m || '0');
        const peakRange = Math.max(parseFloat(result.high_15m || '0') - parseFloat(result.low_15m || '0'), currentPrice * 0.0001);
        const lei = wRekt15m / peakRange;
        const avgRekt = parseFloat(result.avg_15m_rekt || '0');
        const isAbsorption = wRekt15m > Math.max(avgRekt * 3, 50000) && peakRange < (stdDev * 0.6);

        // --- 4. Confluence Score (BALANCED) ---
        const rawVol15m = parseFloat(result.raw_vol_15m || '0'), mean15m = parseFloat(result.avg_15m_vol || '0'), stdDev15m = parseFloat(result.stddev_15m_vol || '0');
        const zScore = stdDev15m > 0 ? (rawVol15m - mean15m) / stdDev15m : 0;

        let bullishScore = 0;
        let bearishScore = 0;

        // Bullish Components
        if (parseFloat(latest.funding_rate || '0') < 0) bullishScore += 0.2;
        if (parseFloat(latest.ls_ratio || '0') < 1.0) bullishScore += 0.2;
        if (marketState === 'ORGANIC_ACCUMULATION' || cvdDivergence === 'BULLISH_DIVERGENCE') bullishScore += 0.3;
        if (isAbsorption && currentPrice < vwap24h) bullishScore += 0.3;

        // Bearish Components
        if (parseFloat(latest.funding_rate || '0') > 0.01) bearishScore += 0.2;
        if (parseFloat(latest.ls_ratio || '0') > 1.2) bearishScore += 0.2;
        if (marketState === 'ORGANIC_DISTRIBUTION' || cvdDivergence === 'BEARISH_DIVERGENCE') bearishScore += 0.3;
        if (isAbsorption && currentPrice > vwap24h) bearishScore += 0.3;

        // --- 5. PhD Optimization: Institutional Intensity & Freshness ---
        // Only amplify score if we have significant whale volume (Z-Score > 1.0)
        // High Z-Score (Anomalous Volume) acts as a high-conviction multiplier
        const intensityMultiplier = Math.min(Math.max(zScore, 1.0), 1.5); 
        
        let confluenceScore = Math.max(bullishScore, bearishScore) * intensityMultiplier;

        // Freshness Check
        const lastWhaleTs = result.last_whale_ts ? new Date(result.last_whale_ts) : new Date(0);
        const isStale = (Date.now() - lastWhaleTs.getTime()) > 1800000; // Stale if no data for 30 mins

        // Penalty for Stale Data (PhD Principle: Never trade on old info)
        if (isStale) confluenceScore *= 0.5;

        return {
            symbol, currentPrice, marketState, cvdDivergence, vwap24h,
            vwapDeviation: vwap24h > 0 ? ((currentPrice - vwap24h) / vwap24h) * 100 : 0,
            pocPrice, pocProximity: pocPrice > 0 ? ((currentPrice - pocPrice) / pocPrice) * 100 : 0,
            whaleAggressionScore: was,
            liquidityPainIndex5m: parseFloat(result.rekt_5m || '0'),
            liquidityExhaustionIndex: lei || 0,
            whaleIntensityZScore: zScore || 0, isAbsorption,
            whaleCvd24h: whaleCvd24h || 0, relativeRekt24h: (parseFloat(result.rekt_24h || '0') / (parseFloat(result.vol_24h || '1') || 1)) * 100,
            oiDelta24h, oiDelta1h, fundingRate: parseFloat(latest.funding_rate || '0'),
            lsRatio: parseFloat(latest.ls_ratio || '0'), confluenceScore: Math.min(confluenceScore, 1.0),
            atr14h: atr14h || (currentPrice * 0.001),
            diagnostics: {
                whaleCount15m: parseInt(result.w_count_15m || '0'),
                rektCount15m: parseInt(result.r_count_15m || '0'),
                lastDataUpdate: lastWhaleTs.toISOString(),
                isStale: isStale
            }
        };
    }
}
