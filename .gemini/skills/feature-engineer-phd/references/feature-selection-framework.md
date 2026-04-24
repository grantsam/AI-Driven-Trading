# Feature Selection Framework (Quantitative Research)

As a PhD researcher, you must follow a rigorous framework for selecting and validating features.

## 1. Hypothesis Generation
- State the market phenomenon you want to capture (e.g., "Institutions accumulate quietly before a breakout").
- Define the observable data point (e.g., "Large order execution with minimal price movement").

## 2. Feature Construction Methodology
- **Raw Data Selection**: Tick data, Order book depth, or OHLCV.
- **Aggregation**: Time-based, Volume-based, or Tick-based bins.
- **Normalization**: Z-Score, ATR-Scaling, or Log-Returns.

## 3. Evaluation Metrics for Features
- **Mutual Information**: Measures the reduction in uncertainty of price direction given the feature.
- **Stationarity**: Ensure the feature's mean and variance do not drift over time (ADF Test).
- **Feature Importance**: Use Random Forest or Permutation Importance during research phase.

## 4. Avoiding Overfitting (The PhD Checklist)
- **Economic Logic**: If the feature has no clear economic reason for existing, it's likely a statistical artifact.
- **Sample Selection Bias**: Does the feature only work in 2024 crypto market?
- **Data Leakage**: Ensure the feature does not use future information (e.g., look-ahead in rolling calculations).

## 5. Design Thinking Application
- **User (AI) Utility**: Is the feature value range normalized enough for an LLM to interpret (e.g., -1 to 1 or 0 to 100)?
- **Interpretability**: Can we explain *why* the feature is high or low at any given time?
