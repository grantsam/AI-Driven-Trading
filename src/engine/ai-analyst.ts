import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';

dotenv.config();

export class AIStrategicAdvisor {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && apiKey !== "YOUR_API_KEY" && apiKey !== "") {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        } else {
            console.warn("[⚠️] Gemini API Key is missing or default. AI Advisor will be disabled.");
        }
    }

    async getStrategicAdvice(metrics: any, additionalContext: any): Promise<{ reasoning: string, verdict: 'BUY' | 'SELL' | 'HOLD' }> {
        if (!this.genAI) {
            return {
                reasoning: "STATUS: LLM_INTEGRATION_PENDING | REASON: GEMINI_API_KEY_NOT_CONFIGURED",
                verdict: 'HOLD'
            };
        }

        const prompt = `
            ROLE: Senior Quantitative Analyst & Market Structure Expert.
            OBJECTIVE: Identify high-probability "Institutional Trace" setups (Accumulation or Distribution).
            ASSET: BTC/USDT Perpetual Futures.

            INSTITUTIONAL DNA:
            - Market State: ${metrics.marketState || 'NEUTRAL'}
            - CVD Divergence: ${metrics.cvdDivergence || 'NONE'}
            - Whale Intensity (Z-Score): ${(metrics.whaleIntensityZScore || 0).toFixed(2)}σ
            - Aggression Score (WAS): ${(metrics.whaleAggressionScore || 0).toFixed(2)} (Positive=Buy, Negative=Sell)
            - Active Whales (15m): ${metrics.diagnostics?.whaleCount15m || 0} participants
            - Rekt Events (15m): ${metrics.diagnostics?.rektCount15m || 0} events
            - Quant Confluence Score: ${(metrics.confluenceScore || 0).toFixed(2)}/1.0

            DATA INTEGRITY & FRESHNESS:
            - Status: ${metrics.diagnostics?.isStale ? '⚠️ STALE DATA' : '✅ FRESH'}
            - Last Update: ${metrics.diagnostics?.lastDataUpdate || 'UNKNOWN'}

            LIQUIDITY & ABSORPTION:
            - Absorption Detected: ${metrics.isAbsorption ? 'YES' : 'NO'}
            - Liquidity Exhaustion (LEI): ${(metrics.liquidityExhaustionIndex || 0).toFixed(4)}
            - Pain Index (5m Rekt): $${(metrics.liquidityPainIndex5m || 0).toLocaleString()}
            - Relative Rekt (24h): ${(metrics.relativeRekt24h || 0).toFixed(4)}% of volume

            MARKET ANCHORS & MOMENTUM:
            - Current Price: $${metrics.currentPrice || 0} (Prev: $${additionalContext.prevPrice || 0})
            - 24h VWAP: ${(metrics.vwap24h || 0).toFixed(2)} (${(metrics.vwapDeviation || 0).toFixed(2)}% dev)
            - 24h POC: ${(metrics.pocPrice || 0).toFixed(2)} (${(metrics.pocProximity || 0).toFixed(2)}% prox)
            - Volatility (ATR): $${(metrics.atr14h || 0).toFixed(2)}
            - Current Volume: ${additionalContext.volume || 0} units

            SENTIMENT & OPEN INTEREST:
            - Funding Rate: ${(metrics.fundingRate || 0).toFixed(6)}%
            - L/S Ratio: ${metrics.lsRatio || 0}
            - OI Delta (1h): ${(metrics.oiDelta1h || 0).toFixed(2)}%
            - OI Delta (24h): ${(metrics.oiDelta24h || 0).toFixed(2)}%
            - Whale CVD (24h): $${(metrics.whaleCvd24h || 0).toLocaleString()}

            ANALYSIS LOGIC:
            - LONG (BUY): High LEI + Absorption=YES + Price < VWAP (Bullish Reversal) OR Squeeze=SHORT_SQUEEZE + WAS > 0.4.
            - SHORT (SELL): High LEI + Absorption=YES + Price > VWAP (Bearish Reversal/Distribution) OR Squeeze=LONG_SQUEEZE + WAS < -0.4.
            - LONG SQUEEZE (Bearish): Funding Rate > 0 + L/S Ratio > 1.2 + Price near Resistance + Negative OI Delta.
            - SHORT SQUEEZE (Bullish): Funding Rate < 0 + L/S Ratio < 0.8 + Price near Support + Negative OI Delta.
            - LIQUIDITY GRAB: Sudden price spike/drop into high-volume zones (POC) followed by WAS reversal and Absorption=YES.
            - DIVERGENCE: BULLISH_DIVERGENCE is Long-Bias, BEARISH_DIVERGENCE is Short-Bias.

            TASK:
            1. Analyze the confluence between Institutional DNA, Liquidity Dynamics, and Momentum.
            2. Specifically look for "Squeeze Traps" and "Liquidity Grabs" (sweeping highs/lows).
            3. Deliver a sharp 2-sentence technical rationale focusing on WHO is trapped and WHERE liquidity is flowing.
            4. Determine the Verdict (BUY/SELL/HOLD).

            OUTPUT: Return ONLY a strict JSON object.
            {
              "reasoning": "Your concise institutional analysis",
              "verdict": "BUY" | "SELL" | "HOLD",
              "confidence": number
            }
        `;

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().replace(/```json|```/g, "").trim();
            const data = JSON.parse(text);

            return { 
                reasoning: data.reasoning || "AI Analysis generated.", 
                verdict: (data.verdict?.toUpperCase() || "HOLD") as 'BUY' | 'SELL' | 'HOLD' 
            };
        } catch (error) {
            console.error("[!] Gemini API Error:", error);
            return { reasoning: `STATUS: AI_OFFLINE | ERROR: ${error instanceof Error ? error.message : String(error)}`, verdict: 'HOLD' };
        }
    }
}
