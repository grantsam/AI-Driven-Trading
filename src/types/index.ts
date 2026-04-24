export interface Candle {
    timestamp: number;
    datetime: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface MarketDataRequest {
    symbol: string;
    timeframe: string;
    limit: number;
}
