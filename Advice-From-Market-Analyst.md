
Raw data is just noise; filtered data is **Intent**. Here is the "Senior Analyst" formula to transpose those samples into something your AI can actually use for a verdict.

---

## 1. The Transformation Formulas

Since you are using **PostgreSQL/Supabase**, you shouldn't send each trade. You should send the **Resultant Force** of those trades over a specific window (e.g., 5-minute or 15-minute blocks).

### A. Whale Aggression Score ($WAS$)
This tells the AI if whales are actively pushing the price or just sitting passively.

$$WAS = \frac{\sum \text{WhaleBuyNotional} - \sum \text{WhaleSellNotional}}{\text{TotalWhaleVolume}}$$

* **Logic:** If $WAS > 0.7$, whales are aggressively market-buying. If $WAS$ is near 0, whales are fighting each other (equilibrium).

### B. Liquidity Exhaustion Index ($LEI$)
This identifies when a "Rekt" event has actually cleared out the stops.

$$LEI = \frac{\text{SumLiquidations}}{\text{PriceDelta}}$$

* **Logic:** If you have high liquidations but the **PriceDelta** is low, it means **Absorption** is happening. A whale is "eating" the liquidations. This is a **Strong Reversal** signal.

---

## 2. What is Missing? (The "Gaps")

Your data samples are great for the **X-Ray View**, but your AI is currently "blind" to two critical institutional components:

### 1. Relative Intensity (Z-Score)
A **$428k** whale sell (from your sample) is significant, but is it "normal" for this time of day? 
* **What's missing:** You need the **Mean Whale Volume** of the last 24 hours. 
* **The Filter:** Your AI needs to see: *"Whale volume is 2.5 standard deviations above normal"* rather than just the raw number.

### 2. The "Open Interest" Context
This is the biggest missing piece. 
* **The Question:** Is that whale sell a **New Short** (Bearish) or a **Long Closing** (Profit Taking)? 
* **The Solution:** You need to fetch **Open Interest (OI)** via CCXT.
    * **Price Down + OI Up** = New Shorts (Aggressive Bearish).
    * **Price Down + OI Down** = Longs Liquidated (Exhaustion/Reversal).

---

## 3. The "Strategic Summary" Template

Instead of sending the raw JSON to Gemini, your Python script should "transpose" it into this **Filtered Summary**:

> **Market Update (15m Window):**
> * **Whale Trace:** Net $WAS$ is **-0.62** (Heavy Selling). Largest single clip: **$428k**.
> * **Rekt Trace:** **$1.2M** in Long Liquidations at **$74,612**. 
> * **Micro Logic:** Price is holding steady despite the liquidations (**Absorption detected**).
> * **Missing Context Check:** Funding is **positive**, suggesting retail is still over-leveraged.

---

## 4. Technical Advice for your Backend
Since you are using **Supabase**, do not perform these calculations in the AI prompt. Perform them in a **PostgreSQL View** or a **Go/Python Worker**. 

1.  **Ingest:** Raw JSON goes into `whale_trades` and `liquidations`.
2.  **Calculate:** A cron job runs every 5 minutes to calculate $WAS$ and $LEI$.
3.  **Prompt:** The AI only reads the calculated "Aggregates" table.

This keeps your token usage low and your AI’s "brain" focused on the high-level strategy rather than doing math.
