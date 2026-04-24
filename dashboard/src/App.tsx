import { useState, useEffect, useRef } from 'react'
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from 'lightweight-charts'
import type { IChartApi } from 'lightweight-charts'
import { 
  Activity, Zap, Clock, ShieldCheck, BarChart3, History, 
  TrendingUp, Database, Layers, List, Target,
  RefreshCw, BrainCircuit, Play, Binary, XCircle, AlertTriangle, Waves, Fingerprint
} from 'lucide-react'
import './index.css'

// Types
interface MarketData {
  symbol: string; timestamp: string; mark_price: number; funding_rate: number; 
  open_interest: number; ls_ratio: number; close: number; volume: number; open: number; high: number; low: number;
}
interface AnalystMetrics {
    symbol: string; currentPrice: number; marketState: string; cvdDivergence: string;
    vwap24h: number; vwapDeviation: number; pocPrice: number; pocProximity: number;
    whaleAggressionScore: number; liquidityPainIndex5m: number; liquidityExhaustionIndex: number;
    whaleIntensityZScore: number; isAbsorption: boolean; whaleCvd24h: number;
    relativeRekt24h: number; oiDelta24h: number; fundingRate: number; lsRatio: number; confluenceScore: number;
    diagnostics: {
        whaleCount15m: number;
        rektCount15m: number;
        lastDataUpdate: string;
        isStale: boolean;
    };
}
interface Position { id: string; symbol: string; type: string; entry_price: number; trailing_sl: number; stop_loss: number; take_profit: number; }
interface Signal { id: string; symbol: string; action: string; reasoning: string; metadata: any; created_at: string; vwap: number; atr: number; oi_delta: number; confluence_score: number; }
interface TradeHistory { 
  id: string; symbol: string; type: string; leverage: number; 
  entry_price: number; exit_price: number; stop_loss: number; take_profit: number; 
  pnl: number; fees: number; net_pnl: number; status: string; 
  created_at: string; closed_at: string; ai_reasoning?: string; ai_verdict?: string; 
}
interface TradeStats {
  symbol: string; period: string; totalTrades: number; winningTrades: number;
  winRate: string; avgGrossPnl: string; avgNetPnl: string; totalNetPnl: string; totalFees: string;
  totalPnlUsd: string;
}

const API_BASE = 'http://localhost:3000/api';
const formatCurrency = (val: number) => Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 });
const formatCompact = (val: number) => Number(val).toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 });
const toWIB = (isoDate: string) => new Date(isoDate).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });

function App() {
  const [view, setView] = useState<'dashboard' | 'history'>('dashboard');
  const [market, setMarket] = useState<MarketData | null>(null);
  const [analyst, setAnalyst] = useState<AnalystMetrics | null>(null);
  const [marketHistory, setMarketHistory] = useState<MarketData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{t:string, s:'info'|'success'|'error'} | null>(null);
  
  const [leftWidth, setLeftWidth] = useState(320);
  const [bottomHeight, setBottomHeight] = useState(250);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const fetchData = async () => {
    try {
      const [mRes, hRes, pRes, sRes, thRes, aRes, stRes] = await Promise.all([
        fetch(`${API_BASE}/market/latest`), fetch(`${API_BASE}/market/history`),
        fetch(`${API_BASE}/positions/active`), fetch(`${API_BASE}/signals/recent`),
        fetch(`${API_BASE}/trades/history`), fetch(`${API_BASE}/market/analyst`),
        fetch(`${API_BASE}/trades/stats`)
      ]);
      
      if (mRes.ok) setMarket(await mRes.json());
      if (hRes.ok) setMarketHistory(await hRes.json());
      if (pRes.ok) setPositions(await pRes.json());
      if (sRes.ok) setSignals(await sRes.json());
      if (thRes.ok) setTradeHistory(await thRes.json());
      if (aRes.ok) setAnalyst(await aRes.json());
      if (stRes.ok) {
        const statsData = await stRes.json();
        console.log("Stats received:", statsData);
        setStats(statsData);
      }
    } catch (err) { console.error('Fetch error:', err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const runWorkflow = async (step: string, payload?: any) => {
    setIsProcessing(step);
    setStatusMsg({ t: `EXECUTING_${step.toUpperCase()}`, s: 'info' });
    try {
      const res = await fetch(`${API_BASE}/workflow/${step}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setStatusMsg({ t: `${step.toUpperCase()}_SUCCESS`, s: 'success' });
        await fetchData();
      } else {
        const errData = await res.json();
        setStatusMsg({ t: errData.error || 'SERVER_ERROR', s: 'error' });
      }
    } catch (err) { setStatusMsg({ t: 'NETWORK_FAILURE', s: 'error' }); }
    finally { 
      setIsProcessing(null); 
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

    // Chart Logic
    useEffect(() => {
        if (!chartContainerRef.current || marketHistory.length === 0) return;
        const container = chartContainerRef.current;
        
        const chart = createChart(container, {
            layout: { 
                background: { type: ColorType.Solid, color: '#0b0e11' }, 
                textColor: '#848e9c',
                fontSize: 10,
                fontFamily: 'Inter, sans-serif'
            },
            grid: { 
                vertLines: { color: 'rgba(43, 49, 57, 0.5)' }, 
                horzLines: { color: 'rgba(43, 49, 57, 0.5)' } 
            },
            crosshair: {
                mode: 0,
                vertLine: { width: 1, color: '#848e9c', style: 3, labelBackgroundColor: '#2b3139' },
                horzLine: { width: 1, color: '#848e9c', style: 3, labelBackgroundColor: '#2b3139' },
            },
            width: container.clientWidth, 
            height: container.clientHeight,
            timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2b3139', barSpacing: 10 },
            rightPriceScale: { borderColor: '#2b3139', autoScale: true, alignLabels: true }
        });

        const candleSeries = chart.addSeries(CandlestickSeries, { 
            upColor: '#0ecb81', downColor: '#f6465d', borderVisible: false, 
            wickUpColor: '#0ecb81', wickDownColor: '#f6465d', lastValueVisible: true,
        });

        const candleData = [...marketHistory].reverse().map(h => ({ 
            time: Math.floor(new Date(h.timestamp).getTime() / 1000) as any, 
            open: Number(h.open), high: Number(h.high), low: Number(h.low), close: Number(h.close) 
        })).filter((v, i, a) => i === 0 || v.time > a[i-1].time);
        
        candleSeries.setData(candleData);

        const volumeSeries = chart.addSeries(HistogramSeries, { 
            color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '', 
        });
        volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        const volumeData = candleData.map((d, i) => ({ 
            time: d.time, 
            value: Number([...marketHistory].reverse()[i]?.volume || 0), 
            color: d.close >= d.open ? 'rgba(14, 203, 129, 0.2)' : 'rgba(246, 70, 93, 0.2)' 
        }));
        volumeSeries.setData(volumeData);

        chart.subscribeCrosshairMove((param) => {
            const container = document.getElementById('chart-legend');
            if (!container) return;
            if (param.time && param.point) {
                const data = param.seriesData.get(candleSeries) as any;
                const volData = param.seriesData.get(volumeSeries) as any;
                if (data) {
                    document.getElementById('legend-open')!.innerText = data.open.toFixed(2);
                    document.getElementById('legend-high')!.innerText = data.high.toFixed(2);
                    document.getElementById('legend-low')!.innerText = data.low.toFixed(2);
                    document.getElementById('legend-close')!.innerText = data.close.toFixed(2);
                    document.getElementById('legend-close')!.className = data.close >= data.open ? 'text-[#0ecb81]' : 'text-[#f6465d]';
                }
                if (volData) document.getElementById('legend-vol')!.innerText = formatCompact(volData.value);
            } else {
                const last = candleData[candleData.length - 1];
                if (last) {
                    document.getElementById('legend-open')!.innerText = last.open.toFixed(2);
                    document.getElementById('legend-high')!.innerText = last.high.toFixed(2);
                    document.getElementById('legend-low')!.innerText = last.low.toFixed(2);
                    document.getElementById('legend-close')!.innerText = last.close.toFixed(2);
                }
            }
        });

        const totalPoints = candleData.length;
        if (totalPoints > 40) {
            chart.timeScale().setVisibleRange({ 
                from: candleData[totalPoints - 40].time, 
                to: candleData[totalPoints - 1].time 
            });
        }
        
        const handleResize = () => chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);
        chartRef.current = chart;
        return () => { resizeObserver.disconnect(); chart.remove(); };
    }, [marketHistory, leftWidth, bottomHeight]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizingLeft) setLeftWidth(Math.max(250, Math.min(e.clientX, 500)));
            if (isResizingBottom) setBottomHeight(Math.max(150, Math.min(window.innerHeight - e.clientY, 500)));
        };
        const handleMouseUp = () => { setIsResizingLeft(false); setIsResizingBottom(false); };
        if (isResizingLeft || isResizingBottom) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
    }, [isResizingLeft, isResizingBottom]);

  const aiAdvice = signals.find(s => s.metadata?.is_ai);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0b0e11] text-[#848e9c] font-sans overflow-hidden select-none">
      {/* HEADER: WORKFLOW CONTROL */}
      <header className="flex items-center justify-between px-4 h-14 bg-[#181a20] border-b border-[#2b3139] shrink-0 z-20 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white font-black italic tracking-tighter">
            <Zap className="w-5 h-5 text-yellow-500 fill-current" />
            <span className="text-sm uppercase tracking-wider">GrantIntelligence</span>
          </div>
          <div className="h-6 w-[1px] bg-gray-800 mx-2"></div>
          <button onClick={() => runWorkflow('sync')} disabled={!!isProcessing} className="flex items-center gap-2 px-3 py-1.5 bg-[#2b3139] hover:bg-gray-700 text-white rounded text-[10px] font-bold border border-gray-700 disabled:opacity-50 transition-all"><RefreshCw className={`w-3 h-3 ${isProcessing === 'sync' ? 'animate-spin' : ''}`} /> [1] SYNC</button>
          <button onClick={() => runWorkflow('prep')} disabled={!!isProcessing} className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/20 hover:bg-yellow-900/40 text-yellow-500 rounded text-[10px] font-bold border border-yellow-500/20 disabled:opacity-50 transition-all"><Binary className={`w-3 h-3 ${isProcessing === 'prep' ? 'animate-pulse' : ''}`} /> [2] PRE-PROCESS</button>
          <button onClick={() => runWorkflow('advise')} disabled={!!isProcessing || !analyst} className="flex items-center gap-2 px-3 py-1.5 bg-blue-900/40 hover:bg-blue-900/60 text-blue-400 rounded text-[10px] font-bold border border-blue-500/30 disabled:opacity-50 transition-all"><BrainCircuit className={`w-3 h-3 ${isProcessing === 'advise' ? 'animate-pulse text-yellow-300' : ''}`} /> [3] AI_FILTERING</button>
          <button onClick={() => runWorkflow('execute', {action: 'BUY'})} disabled={!!isProcessing || !aiAdvice || aiAdvice.action !== 'BUY'} className="flex items-center gap-2 px-4 py-1.5 bg-[#0ecb81] hover:bg-[#0ba36d] text-black rounded text-[10px] font-black disabled:opacity-10 transition-all shadow-[0_0_15px_rgba(14,203,129,0.2)]"><Play className="w-3 h-3" /> [4] EXECUTE BUY</button>
          <div className="h-6 w-[1px] bg-gray-800 mx-2"></div>
          <button onClick={() => setView(view === 'dashboard' ? 'history' : 'dashboard')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold border transition-all ${view === 'history' ? 'bg-blue-600 text-white border-blue-400' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'}`}><History className="w-3 h-3" /> {view === 'dashboard' ? 'PNL HISTORY' : 'TERMINAL'}</button>
        </div>

        <div className="flex items-center gap-4 text-[10px] font-mono font-bold text-white opacity-60 bg-[#0b0e11] px-4 py-1.5 rounded border border-gray-800">
          <span>{market ? `$${formatCurrency(market.mark_price)}` : 'STATUS: DATA_NOT_FOUND'}</span>
          <span className="text-gray-700">|</span>
          <span>{new Date().toLocaleTimeString('id-ID', {timeZone: 'Asia/Jakarta'})} WIB</span>
        </div>
      </header>

      {view === 'dashboard' ? (
        <main className="flex-1 flex overflow-hidden">
          {/* LEFT: INTELLIGENCE HUB */}
          <aside style={{ width: leftWidth }} className="bg-[#181a20] flex flex-col shrink-0 border-r border-[#2b3139] z-10 shadow-2xl relative">
            <div className="p-3 bg-[#1e2329] border-b border-[#2b3139] flex items-center justify-between"><h2 className="text-[10px] font-bold text-white uppercase flex items-center gap-2"><BarChart3 className="w-3 h-3 text-yellow-500" /> Intelligence Hub</h2></div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
              
              {/* MARKET STATE SNAPSHOT */}
              <section className="space-y-3">
                <h3 className="text-[9px] font-black text-yellow-500 uppercase tracking-widest flex items-center gap-2"><Fingerprint className="w-3 h-3"/> Market DNA</h3>
                <div className="bg-[#0b0e11] p-3 rounded border border-gray-800 font-mono text-[9px] leading-relaxed space-y-2">
                    {analyst ? (
                      <>
                        <div className="flex justify-between border-b border-gray-900 pb-1">
                            <span className="text-gray-500">STATE</span>
                            <span className={`font-black ${analyst.marketState.includes('ACC') || analyst.marketState.includes('SQUEEZE') ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{analyst.marketState}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-900 pb-1">
                            <span className="text-gray-500">DIVERGENCE</span>
                            <span className={`font-black ${analyst.cvdDivergence === 'NONE' ? 'text-gray-600' : 'text-yellow-500 animate-pulse'}`}>{analyst.cvdDivergence}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-900 pb-1">
                            <span className="text-gray-500">CONFLUENCE</span>
                            <span className="text-white font-black">{(analyst.confluenceScore * 100).toFixed(0)}%</span>
                        </div>
                        <div className="mt-2 text-[8px] text-gray-600 italic">-- DYNAMIC_SCALING_ACTIVE --</div>
                      </>
                    ) : <span className="text-gray-600 animate-pulse">BOOTING_ANALYST...</span>}
                </div>
              </section>

              {/* SYSTEM HEALTH DIAGNOSTICS */}
              <section className="space-y-3">
                <h3 className="text-[9px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-2"><Activity className="w-3 h-3"/> System Health</h3>
                <div className="bg-[#0b0e11] p-3 rounded border border-gray-800 font-mono text-[9px] space-y-2">
                    {analyst && analyst.diagnostics ? (
                      <>
                        <div className="flex justify-between">
                            <span className="text-gray-500">WHALES (15m)</span>
                            <span className={analyst.diagnostics.whaleCount15m > 0 ? 'text-[#0ecb81]' : 'text-gray-600'}>{analyst.diagnostics.whaleCount15m} TRADES</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">REKTS (15m)</span>
                            <span className={analyst.diagnostics.rektCount15m > 0 ? 'text-red-500' : 'text-gray-600'}>{analyst.diagnostics.rektCount15m} EVENTS</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-gray-900">
                            <span className="text-gray-500">LAST_DATA</span>
                            <span className={analyst.diagnostics.isStale ? 'text-red-500 animate-pulse' : 'text-blue-400'}>{toWIB(analyst.diagnostics.lastDataUpdate)}</span>
                        </div>
                        {analyst.diagnostics.isStale && (
                            <div className="text-[8px] text-red-500/80 font-bold uppercase text-center mt-1">⚠️ DATA_FLOW_STOPPED_CHECK_SYNC</div>
                        )}
                      </>
                    ) : <span className="text-gray-600">WAITING_FOR_HEALTH_PROBE...</span>}
                </div>
              </section>

              {/* WHALE INTENT (MICRO) */}
              <section className="space-y-3">
                <h3 className="text-[9px] font-black text-[#0ecb81] uppercase tracking-widest flex items-center gap-2"><Waves className="w-3 h-3"/> Whale Flow (Micro)</h3>
                <div className="bg-[#0b0e11] p-3 rounded border border-gray-800 space-y-3">
                    {analyst && (
                        <>
                            <div className="space-y-1">
                                <div className="flex justify-between text-[8px] uppercase text-gray-500"><span>Aggression (WAS)</span><span className={analyst.whaleAggressionScore > 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{analyst.whaleAggressionScore.toFixed(4)}</span></div>
                                <div className="h-1 bg-gray-900 rounded-full overflow-hidden flex">
                                    <div style={{ width: `${Math.max(0, analyst.whaleAggressionScore + 1) * 50}%` }} className={`h-full ${analyst.whaleAggressionScore > 0 ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`}></div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 font-mono text-[9px]">
                                <div className="p-2 bg-[#181a20] rounded border border-gray-800">
                                    <div className="text-gray-600 text-[8px] uppercase">Z-Score</div>
                                    <div className={`font-bold ${Math.abs(analyst.whaleIntensityZScore) > 2 ? 'text-yellow-500' : 'text-white'}`}>{analyst.whaleIntensityZScore.toFixed(2)}σ</div>
                                </div>
                                <div className="p-2 bg-[#181a20] rounded border border-gray-800">
                                    <div className="text-gray-600 text-[8px] uppercase">Pain (5m)</div>
                                    <div className="font-bold text-red-500">${formatCompact(analyst.liquidityPainIndex5m)}</div>
                                </div>
                            </div>
                            {analyst.isAbsorption && (
                                <div className="p-2 bg-yellow-900/20 border border-yellow-500/50 rounded flex items-center gap-2 animate-bounce">
                                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                    <span className="text-[9px] font-black text-yellow-500 uppercase">ABSORPTION_DETECTED</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
              </section>

              {/* AI STRATEGIC ADVICE */}
              <section className="space-y-3">
                <h3 className="text-[9px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2"><BrainCircuit className="w-3 h-3"/> AI Strategic Advice</h3>
                <div className="bg-blue-900/10 p-4 rounded border border-blue-500/30 min-h-[140px] relative">
                    <p className="text-[10px] text-blue-100 italic leading-relaxed font-serif">
                      {aiAdvice ? aiAdvice.reasoning : "STATUS: WAITING_FOR_LLM_VALIDATION"}
                    </p>
                    {aiAdvice && (
                      <div className="mt-4 pt-3 border-t border-blue-500/20 flex justify-between items-center">
                        <span className="text-[8px] font-bold uppercase text-blue-400 tracking-tighter">AI VERDICT:</span>
                        <span className={`px-3 py-0.5 rounded-full text-[9px] font-black ${aiAdvice.action === 'BUY' ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-gray-700 text-white'}`}>{aiAdvice.action}</span>
                      </div>
                    )}
                </div>
              </section>
            </div>
          </aside>

          <div onMouseDown={() => setIsResizingLeft(true)} className="w-1 bg-[#2b3139] hover:bg-blue-500 cursor-col-resize transition-colors shrink-0 z-10" />

          {/* CENTER: WAR ROOM */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#0b0e11]">
            <div className="flex-1 bg-[#181a20] flex flex-col overflow-hidden p-4 relative min-h-0">
              <div className="flex justify-between mb-2 shrink-0 items-center">
                 <div className="text-[10px] font-bold text-white uppercase flex items-center gap-2"><TrendingUp className="w-3 h-3 text-[#0ecb81]" /> Market Price Action (1H)</div>
                 <div className="flex items-center gap-4 text-[8px] font-mono">
                    <span className="flex items-center gap-1 text-yellow-500"><Target className="w-2 h-2"/> POC: ${formatCurrency(analyst?.pocPrice || 0)}</span>
                    <span className="flex items-center gap-1 text-blue-400"><Database className="w-2 h-2"/> VWAP: ${formatCurrency(analyst?.vwap24h || 0)}</span>
                 </div>
              </div>

              {/* CHART LEGEND OVERLAY */}
              <div id="chart-legend" className="absolute top-12 left-8 z-10 font-mono text-[10px] flex gap-3 pointer-events-none bg-[#181a20]/80 p-1 rounded border border-gray-800/50">
                  <div className="flex gap-1"><span className="text-gray-500">O</span><span id="legend-open" className="text-white">-</span></div>
                  <div className="flex gap-1"><span className="text-gray-500">H</span><span id="legend-high" className="text-white">-</span></div>
                  <div className="flex gap-1"><span className="text-gray-500">L</span><span id="legend-low" className="text-white">-</span></div>
                  <div className="flex gap-1"><span className="text-gray-500">C</span><span id="legend-close" className="text-white">-</span></div>
                  <div className="flex gap-1 border-l border-gray-700 pl-2"><span className="text-gray-500">V</span><span id="legend-vol" className="text-yellow-500">-</span></div>
            </div>
            <div ref={chartContainerRef} className="flex-1"></div>
          </div>            
          <div onMouseDown={() => setIsResizingBottom(true)} className="h-1 bg-[#2b3139] hover:bg-blue-500 cursor-row-resize transition-colors shrink-0 z-10" />

            {/* DATA GRID */}
            <div style={{ height: bottomHeight }} className="flex overflow-hidden shrink-0 border-t border-[#2b3139]">
              <div className="flex-1 flex flex-col border-r border-[#2b3139] bg-[#0b0e11]">
                <div className="p-2 bg-[#181a20] border-b border-[#2b3139] flex items-center justify-between"><h2 className="text-[10px] font-bold text-white uppercase flex items-center gap-2"><Activity className="w-3 h-3 text-[#0ecb81]" /> Active Positions</h2></div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {positions.length > 0 ? positions.map((pos) => {
                    const pnl = ((Number(market?.mark_price || 0) - Number(pos.entry_price)) / Number(pos.entry_price)) * 100;
                    return (
                      <div key={pos.id} className="bg-[#181a20] border border-[#2b3139] rounded p-3 shadow-inner">
                        <div className="flex justify-between mb-2"><span className="text-[9px] font-bold text-white flex items-center gap-2"><Target className="w-3 h-3 text-yellow-500"/> {pos.type} {pos.symbol}</span><span className={`text-xs font-mono font-black ${pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(4)}%</span></div>
                        <div className="grid grid-cols-3 gap-2 text-[8px] font-mono text-gray-400">
                          <div className="flex flex-col"><span>ENTRY</span><span className="text-white">${formatCurrency(pos.entry_price)}</span></div>
                          <div className="flex flex-col"><span>TARGET</span><span className="text-[#0ecb81]">${formatCurrency(pos.take_profit)}</span></div>
                          <div className="flex flex-col"><span>TR_STOP</span><span className="text-yellow-500">${formatCurrency(pos.trailing_sl || pos.stop_loss)}</span></div>
                        </div>
                      </div>
                    )
                  }) : <div className="h-full flex flex-col items-center justify-center opacity-10 font-bold uppercase tracking-widest text-[10px]">SCANNING_FOR_LIQUIDITY</div>}
                </div>
              </div>
              <div className="flex-[1.5] flex flex-col bg-[#181a20]">
                <div className="p-2 bg-[#1e2329] border-b border-[#2b3139] flex items-center justify-between"><h2 className="text-[10px] font-bold text-white uppercase flex items-center gap-2"><Layers className="w-3 h-3 text-blue-400" /> Institutionals Overview</h2></div>
                <div className="flex-1 grid grid-cols-2 gap-4 p-4">
                    {analyst && (
                        <>
                            <div className="space-y-2">
                                <div className="text-[9px] text-gray-500 uppercase font-black">24H MARKET FLOW</div>
                                <div className="bg-[#0b0e11] p-3 rounded border border-gray-800 space-y-2 font-mono">
                                    <div className="flex justify-between text-[9px]"><span>Whale CVD (24h)</span><span className={analyst.whaleCvd24h > 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>${formatCompact(analyst.whaleCvd24h)}</span></div>
                                    <div className="flex justify-between text-[9px]"><span>OI Delta (24h)</span><span className={analyst.oiDelta24h > 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{analyst.oiDelta24h.toFixed(2)}%</span></div>
                                    <div className="flex justify-between text-[9px]"><span>Relative Rekt</span><span className="text-yellow-500">{analyst.relativeRekt24h.toFixed(4)}%</span></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-[9px] text-gray-500 uppercase font-black">PRICE DISCOVERY</div>
                                <div className="bg-[#0b0e11] p-3 rounded border border-gray-800 space-y-2 font-mono">
                                    <div className="flex justify-between text-[9px]"><span>VWAP Distance</span><span className={Math.abs(analyst.vwapDeviation) < 1 ? 'text-[#0ecb81]' : 'text-yellow-500'}>{analyst.vwapDeviation.toFixed(2)}%</span></div>
                                    <div className="flex justify-between text-[9px]"><span>POC Distance</span><span className={Math.abs(analyst.pocProximity) < 0.5 ? 'text-[#0ecb81]' : 'text-yellow-500'}>{analyst.pocProximity.toFixed(2)}%</span></div>
                                    <div className="flex justify-between text-[9px]"><span>Funding Rate</span><span className={analyst.fundingRate < 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{(analyst.fundingRate * 100).toFixed(4)}%</span></div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: AUDIT TRAIL */}
          <aside className="w-[300px] bg-[#181a20] flex flex-col shrink-0 border-l border-[#2b3139] shadow-2xl relative z-10">
            <div className="p-3 border-b border-[#2b3139] bg-[#1e2329] flex items-center justify-between"><h2 className="text-[10px] font-bold text-white uppercase flex items-center gap-2"><History className="w-3 h-3 text-blue-500" /> Signal Audit</h2></div>
            <div className="flex-1 overflow-y-auto p-2 bg-[#0b0e11] space-y-1 custom-scrollbar">
              {signals.map((sig) => (
                  <div key={sig.id} className={`p-2 border-b border-gray-900 ${sig.metadata?.is_ai ? 'bg-blue-900/10' : sig.action === 'PRE_PROCESS' ? 'bg-yellow-900/5' : ''}`}>
                    <div className="flex justify-between items-center mb-1 font-mono">
                      <span className={`text-[9px] font-bold ${sig.metadata?.is_ai ? 'text-blue-400 underline' : sig.action === 'PRE_PROCESS' ? 'text-yellow-500' : sig.action === 'BUY' ? 'text-[#0ecb81]' : 'text-gray-500'}`}>{sig.action}</span>
                      <span className="text-[8px] text-gray-600">{toWIB(sig.created_at)}</span>
                    </div>
                    <p className={`text-[9px] leading-tight ${sig.metadata?.is_ai ? 'text-blue-100 italic' : 'text-gray-400'}`}>{sig.reasoning}</p>
                  </div>
              ))}
            </div>
            <footer className="p-3 bg-[#1e2329] border-t border-[#2b3139] shrink-0"><div className="flex items-center justify-center gap-2 opacity-30"><ShieldCheck className="w-3 h-3 text-[#0ecb81]" /><span className="text-[8px] font-bold uppercase tracking-widest text-white">System_Stable_V1.1</span></div></footer>
          </aside>
        </main>
      ) : (
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0b0e11] p-6">
          <div className="max-w-6xl mx-auto w-full flex flex-col h-full space-y-4">
             <div className="flex justify-between items-end border-b border-gray-800 pb-4">
                <div>
                   <h1 className="text-2xl font-black text-white italic tracking-tighter flex items-center gap-3"><History className="w-8 h-8 text-blue-500" /> PNL HISTORY & AI AUDIT</h1>
                   <p className="text-xs text-gray-500 font-mono mt-1">TOTAL_TRADES_EXECUTED: {tradeHistory.length}</p>
                </div>
             </div>

             {/* PERFORMANCE CARDS GRID */}
             <div className="grid grid-cols-4 gap-4 mb-2">
                <div className="bg-[#181a20] p-4 rounded border border-gray-800 shadow-lg">
                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Win Rate (7D)</div>
                    <div className="text-2xl font-black text-white">{stats?.winRate || '0%'}</div>
                    <div className="text-[9px] text-gray-600 mt-1">{stats?.winningTrades} / {stats?.totalTrades} Trades</div>
                </div>
                <div className="bg-[#181a20] p-4 rounded border border-gray-800 shadow-lg">
                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total PnL ($)</div>
                    <div className={`text-2xl font-black ${Number(stats?.totalPnlUsd || 0) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {Number(stats?.totalPnlUsd || 0) >= 0 ? '+' : ''}${formatCurrency(Number(stats?.totalPnlUsd || 0))}
                    </div>
                    <div className="text-[9px] text-gray-600 mt-1">Price Movement Sum</div>
                </div>
                <div className="bg-[#181a20] p-4 rounded border border-gray-800 shadow-lg">
                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Avg Net / Trade</div>
                    <div className="text-2xl font-black text-blue-400">{stats?.avgNetPnl || '0%'}</div>
                    <div className="text-[9px] text-gray-600 mt-1">Incl. Taker Fees</div>
                </div>
                <div className="bg-[#181a20] p-4 rounded border border-gray-800 shadow-lg">
                    <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Net PnL (%)</div>
                    <div className={`text-2xl font-black ${Number(stats?.totalNetPnl.replace('%','')) >= 0 ? 'text-[#0ecb81]' : 'text-red-400'}`}>
                        {stats?.totalNetPnl || '0%'}
                    </div>
                    <div className="text-[9px] text-gray-600 mt-1">Leverage Adjusted</div>
                </div>
             </div>

             <div className="flex-1 bg-[#181a20] rounded border border-[#2b3139] overflow-hidden flex flex-col shadow-2xl">
                <div className="overflow-auto custom-scrollbar flex-1">
                   <table className="w-full text-left font-mono text-[10px]">
                      <thead className="sticky top-0 bg-[#1e2329] text-gray-500 border-b border-[#2b3139]">
                         <tr>
                            <th className="p-4">TIME_CLOSED</th>
                            <th className="p-4">SYMBOL</th>
                            <th className="p-4">TYPE</th>
                            <th className="p-4 text-right">ENTRY</th>
                            <th className="p-4 text-right">EXIT</th>
                            <th className="p-4 text-right">PnL ($)</th>
                            <th className="p-4 text-right">GROSS (%)</th>
                            <th className="p-4 text-right">FEES (%)</th>
                            <th className="p-4 text-right">NET (%)</th>
                            <th className="p-4">AI_REASONING_SNAPSHOT</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-900">
                         {tradeHistory.map((t) => {
                            const pnlUsd = (Number(t.exit_price) - Number(t.entry_price)) * (t.type === 'BUY' ? 1 : -1);
                            return (
                               <tr key={t.id} className="hover:bg-gray-800/30 transition-colors group">
                                  <td className="p-4 text-gray-500">{toWIB(t.closed_at)}</td>
                                  <td className="p-4 text-white font-bold">{t.symbol}</td>
                                  <td className="p-4"><span className={`px-2 py-0.5 rounded text-[8px] font-black ${t.type === 'BUY' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{t.type}</span></td>
                                  <td className="p-4 text-right text-gray-300">${formatCurrency(t.entry_price)}</td>
                                  <td className="p-4 text-right text-white">${formatCurrency(t.exit_price)}</td>
                                  <td className={`p-4 text-right font-black ${pnlUsd >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                                     {pnlUsd >= 0 ? '+' : ''}${formatCurrency(pnlUsd)}
                                  </td>
                                  <td className={`p-4 text-right font-black ${Number(t.pnl) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{Number(t.pnl).toFixed(2)}%</td>
                                  <td className="p-4 text-right text-red-400">-{Number(t.fees).toFixed(2)}%</td>
                                  <td className={`p-4 text-right font-black ${Number(t.net_pnl) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{Number(t.net_pnl).toFixed(2)}%</td>
                                  <td className="p-4 max-w-xs"><div className="text-[9px] text-gray-500 italic truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all">{t.ai_reasoning || "SYSTEM_EXECUTED_NO_AI_CONTEXT"}</div></td>
                               </tr>
                            );
                         })}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        </main>
      )}

      {statusMsg && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded shadow-2xl border flex items-center gap-3 z-[100] transition-all duration-300 ${statusMsg.s === 'success' ? 'bg-green-900 border-green-500 text-white' : statusMsg.s === 'error' ? 'bg-red-900 border-red-500 text-white' : 'bg-blue-900 border-blue-500 text-white'}`}>
          {statusMsg.s === 'success' ? <ShieldCheck className="w-5 h-5 animate-bounce"/> : statusMsg.s === 'error' ? <XCircle className="w-5 h-5"/> : <RefreshCw className="w-5 h-5 animate-spin"/>}
          <span className="text-sm font-black tracking-tight uppercase font-mono">{statusMsg.t}</span>
        </div>
      )}
    </div>
  )
}

export default App
