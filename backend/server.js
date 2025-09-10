const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { getUnifiedMarketSnapshot } = require('./services/getUnifiedMarketSnapshot');
const { fetchBinanceData } = require('./services/binance');
const { fetchGeminiSentiment } = require('./services/geminiSentiment');
const { calculateRSI } = require('./services/indicators');
const { scanArbitrage } = require('./services/arbitrageScanner');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

/* ============================ */
/* Storage and config           */
/* ============================ */

const DATA_DIR = __dirname;
const BACKTEST_ARCHIVE_DIR = path.join(DATA_DIR, 'backtests');
const LAST_BACKTEST_SUMMARY = path.join(DATA_DIR, 'lastBacktest.json');

const LIVE_DIR = path.join(DATA_DIR, 'live');
const LIVE_TRADES_PATH = path.join(LIVE_DIR, 'liveTrades.json');
const LIVE_STATUS_PATH = path.join(LIVE_DIR, 'liveStatus.json');

if (!fs.existsSync(BACKTEST_ARCHIVE_DIR)) fs.mkdirSync(BACKTEST_ARCHIVE_DIR, { recursive: true });
if (!fs.existsSync(LIVE_DIR)) fs.mkdirSync(LIVE_DIR, { recursive: true });

/* ============================ */
/* Helpers                      */
/* ============================ */

function evaluateLogic(expression, context) {
  try {
    const fn = new Function(...Object.keys(context), `return ${expression};`);
    return fn(...Object.values(context));
  } catch (err) {
    console.error('Logic eval error:', err.message);
    return false;
  }
}

const isoStamp = () => new Date().toISOString();
const fileSafeStamp = () => isoStamp().replace(/[:.]/g, '-');
const daysToMs = d => d * 24 * 60 * 60 * 1000;

/* ============================ */
/* Preview and test             */
/* ============================ */

app.get('/api/preview', async (req, res) => {
  try {
    const strategy = JSON.parse(fs.readFileSync(path.join(__dirname, 'strategy.json'), 'utf8'));
    const snapshot = await getUnifiedMarketSnapshot();

    const indicators = { RSI: snapshot.RSI, Sentiment: snapshot.Sentiment };
    const buyLogic = strategy.modules.find(m => m.type === 'ExecutionLogic')?.params?.buy;
    const sellLogic = strategy.modules.find(m => m.type === 'ExecutionLogic')?.params?.sell;

    const buy = evaluateLogic(buyLogic, indicators);
    const sell = evaluateLogic(sellLogic, indicators);

    let action = 'hold';
    if (buy) action = 'buy';
    else if (sell) action = 'sell';

    res.json({
      indicators,
      logic: { buy: buyLogic, sell: sellLogic },
      action,
      simulated: {
        profit: buy ? 0.015 : sell ? -0.008 : 0,
        confidence: Number(indicators.Sentiment).toFixed(2),
        accuracy: 'N/A'
      }
    });
  } catch (err) {
    console.error('Preview error:', err.message);
    res.status(500).send('Failed to simulate preview');
  }
});

app.get('/api/test-sim', async (req, res) => {
  const startingCash = 50;
  try {
    const strategy = JSON.parse(fs.readFileSync(path.join(__dirname, 'strategy.json'), 'utf8'));
    const snapshot = await getUnifiedMarketSnapshot();
    const indicators = { RSI: snapshot.RSI, Sentiment: snapshot.Sentiment };

    const buyLogic = strategy.modules.find(m => m.type === 'ExecutionLogic')?.params?.buy;
    const sellLogic = strategy.modules.find(m => m.type === 'ExecutionLogic')?.params?.sell;

    const buy = evaluateLogic(buyLogic, indicators);
    const sell = evaluateLogic(sellLogic, indicators);

    let action = 'hold';
    let profit = 0;
    if (buy) { action = 'buy'; profit = startingCash * 0.015; }
    else if (sell) { action = 'sell'; profit = startingCash * -0.008; }

    const endingBalance = startingCash + profit;

    res.json({
      indicators,
      logic: { buy: buyLogic, sell: sellLogic },
      action,
      simulation: {
        startingCash,
        positionSize: startingCash,
        simulatedProfit: Number(profit.toFixed(4)),
        endingBalance: Number(endingBalance.toFixed(2)),
        confidence: Number(indicators.Sentiment).toFixed(2)
      }
    });
  } catch (err) {
    console.error('TestSim error:', err.message);
    res.status(500).send('Failed to simulate test tick');
  }
});

/* ============================ */
/* Backtest + archives          */
/* ============================ */

app.get('/api/backtest', async (req, res) => {
  const startingCash = 50;
  let balance = startingCash;
  let trades = [];

  try {
    const strategy = JSON.parse(fs.readFileSync(path.join(__dirname, 'strategy.json'), 'utf8'));
    const candles = await fetchBinanceData('BTCUSDT', '15m', 672);

    const gemini = await fetchGeminiSentiment('Bitcoin market sentiment over the past week');
    const cachedSentiment = typeof gemini.sentiment === 'number' ? gemini.sentiment : 0;

    let tradesExecuted = 0;
    let netProfit = 0;

    for (let i = 14; i < candles.length; i++) {
      const slice = candles.slice(i - 14, i + 1);
      const rsi = calculateRSI(slice, 14);

      const indicators = { RSI: typeof rsi === 'number' ? rsi : 0, Sentiment: cachedSentiment };
      const buyLogic = strategy.modules.find(m => m.type === 'ExecutionLogic')?.params?.buy;
      const sellLogic = strategy.modules.find(m => m.type === 'ExecutionLogic')?.params?.sell;

      const buy = evaluateLogic(buyLogic, indicators);
      const sell = evaluateLogic(sellLogic, indicators);

      let action = 'hold';
      let profit = 0;

      if (buy) {
        action = 'buy';
        profit = balance * 0.015;
        balance += profit;
        tradesExecuted++;
        netProfit += profit;
      } else if (sell) {
        action = 'sell';
        profit = balance * -0.008;
        balance += profit;
        tradesExecuted++;
        netProfit += profit;
      }

      trades.push({
        time: candles[i].closeTime,
        RSI: indicators.RSI,
        Sentiment: indicators.Sentiment,
        action,
        profit: Number(profit.toFixed(4)),
        balance: Number(balance.toFixed(2))
      });
    }

    const accuracy = `${Math.round((trades.filter(t => t.profit > 0).length / (tradesExecuted || 1)) * 100)}%`;
    const engagementRate = `${((tradesExecuted / trades.length) * 100).toFixed(2)}%`;

    const summary = {
      timestamp: isoStamp(),
      startingCash,
      endingBalance: Number(balance.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      tradesExecuted,
      engagementRate,
      accuracy,
      candlesAnalyzed: trades.length
    };

    fs.writeFileSync(LAST_BACKTEST_SUMMARY, JSON.stringify(summary, null, 2));
    const archivePath = path.join(BACKTEST_ARCHIVE_DIR, `backtest-${fileSafeStamp()}.json`);
    fs.writeFileSync(archivePath, JSON.stringify({ ...summary, trades }, null, 2));

    res.json({ ...summary, trades });
  } catch (err) {
    console.error('Backtest error:', err.message);
    res.status(500).send('Backtest failed');
  }
});

app.get('/api/summary', (req, res) => {
  try {
    const lastRun = fs.readFileSync(LAST_BACKTEST_SUMMARY, 'utf8');
    res.json(JSON.parse(lastRun));
  } catch {
    res.status(404).json({ error: 'No summary available yet' });
  }
});

app.get('/api/history', (req, res) => {
  try {
    const { limit = 20, offset = 0, includeTrades = 'false' } = req.query;
    const files = fs
      .readdirSync(BACKTEST_ARCHIVE_DIR)
      .filter(f => f.startsWith('backtest-') && f.endsWith('.json'))
      .map(f => path.join(BACKTEST_ARCHIVE_DIR, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

    const docs = files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
    const sliced = docs.slice(Number(offset), Number(offset) + Number(limit));
    const wantTrades = String(includeTrades).toLowerCase() === 'true';
    const results = sliced.map(d => (wantTrades ? d : (({ trades, ...rest }) => rest)(d)));
    res.json({ count: docs.length, limit: Number(limit), offset: Number(offset), results });
  } catch (err) {
    console.error('History error:', err.message);
    res.status(500).json({ error: 'Failed to load history' });
  }
});

/* ============================ */
/* Arbitrage scan + config      */
/* ============================ */

const arbConfig = {
  enabled: true,
  symbol: 'BTC',
  quote: 'USDT',
  minNetSpreadPct: 0.25, // e.g., require >= 0.25% net after fees
  notional: 25           // mock notional per arb cycle
};

app.get('/api/arbitrage/scan', async (req, res) => {
  try {
    const symbol = (req.query.symbol || arbConfig.symbol).toUpperCase();
    const quote = (req.query.quote || arbConfig.quote).toUpperCase();
    const scan = await scanArbitrage({ symbol, quote });
    res.json({ config: { ...arbConfig, symbol, quote }, ...scan });
  } catch (err) {
    console.error('Arb scan error:', err.message);
    res.status(500).json({ error: 'Arbitrage scan failed' });
  }
});

app.get('/api/arbitrage-config', (req, res) => {
  res.json(arbConfig);
});

app.post('/api/arbitrage-config', (req, res) => {
  const { enabled, symbol, quote, minNetSpreadPct, notional } = req.body || {};
  if (enabled !== undefined) arbConfig.enabled = !!enabled;
  if (symbol) arbConfig.symbol = symbol.toUpperCase();
  if (quote) arbConfig.quote = quote.toUpperCase();
  if (minNetSpreadPct !== undefined) arbConfig.minNetSpreadPct = Number(minNetSpreadPct);
  if (notional !== undefined) arbConfig.notional = Number(notional);
  res.json(arbConfig);
});

/* ============================ */
/* Live mode + arbitrage        */
/* ============================ */

const liveState = {
  running: false,
  intervalMs: 60_000,
  startingCash: 50,
  balance: 50,
  position: 0,
  entryPrice: null,
  lastAction: 'idle',
  lastError: null,
  lastRun: null,
  cycles: 0,
  tradesToday: 0,
  pnlToday: 0,
  maxDailyLoss: 5,
  maxPosition: 50,
  cooldownMs: 0,
  nextAllowedTs: 0,
  // arbitrage
  arb: {
    enabled: true,
    last: null
  }
};

let liveTimer = null;

function saveLiveStatus(extra = {}) {
  const status = { ...liveState, ...extra, timestamp: isoStamp(), arbConfig };
  fs.writeFileSync(LIVE_STATUS_PATH, JSON.stringify(status, null, 2));
}

function appendLiveTrade(trade) {
  const stamp = fileSafeStamp();
  const archiveName = `live-${stamp}.json`;
  const archivePath = path.join(LIVE_DIR, archiveName);

  let arr = [];
  if (fs.existsSync(LIVE_TRADES_PATH)) {
    try { arr = JSON.parse(fs.readFileSync(LIVE_TRADES_PATH, 'utf8')); } catch {}
  }
  arr.push(trade);
  fs.writeFileSync(LIVE_TRADES_PATH, JSON.stringify(arr, null, 2));
  fs.writeFileSync(archivePath, JSON.stringify(trade, null, 2));
}

async function maybeExecuteArbitrage() {
  if (!arbConfig.enabled) return null;
  const scan = await scanArbitrage({ symbol: arbConfig.symbol, quote: arbConfig.quote });
  const best = scan.best;
  if (!best) return null;

  const net = best.netPct; // percent
  if (net >= arbConfig.minNetSpreadPct) {
    // Mock instant cross-exchange roundtrip (no transfer latency)
    const notional = Math.min(arbConfig.notional, liveState.balance);
    if (notional <= 0) return null;

    const gross = notional * (best.grossPct / 100);
    const feesCost = notional * (best.estFeesPct / 100);
    const pnl = gross - feesCost;

    liveState.balance += pnl;
    liveState.pnlToday += pnl;

    const trade = {
      timestamp: isoStamp(),
      type: 'arbitrage',
      path: best.path,
      symbol: scan.symbol,
      quote: scan.quote,
      buyPrice: best.buyPrice,
      sellPrice: best.sellPrice,
      grossPct: best.grossPct,
      estFeesPct: best.estFeesPct,
      netPct: best.netPct,
      notional: Number(notional.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      balance: Number(liveState.balance.toFixed(2))
    };
    appendLiveTrade(trade);
    liveState.arb.last = trade;
    return trade;
  }
  return null;
}

async function runLiveCycle() {
  const now = Date.now();
  if (!liveState.running) return;
  if (liveState.cooldownMs && now < liveState.nextAllowedTs) return;

  try {
    const strategy = JSON.parse(fs.readFileSync(path.join(__dirname, 'strategy.json'), 'utf8'));
    const snapshot = await getUnifiedMarketSnapshot();
    const indicators = { RSI: snapshot.RSI, Sentiment: snapshot.Sentiment };

    const buyLogic = strategy.modules.find(m => m.type === 'ExecutionLogic')?.params?.buy;
    const sellLogic = strategy.modules.find(m => m.type === 'ExecutionLogic')?.params?.sell;

    const buy = evaluateLogic(buyLogic, indicators);
    const sell = evaluateLogic(sellLogic, indicators);

    const price = Number(snapshot.price || snapshot.lastPrice || snapshot.close || 0);
    if (!price || Number.isNaN(price)) throw new Error('Snapshot price not available');

    // Guardrail: daily stop
    if (liveState.pnlToday <= -Math.abs(liveState.maxDailyLoss)) {
      liveState.running = false;
      liveState.lastAction = 'halted_max_daily_loss';
      saveLiveStatus();
      return;
    }

    let action = 'hold';
    let trade = null;

    const positionSize = Math.min(liveState.balance, liveState.maxPosition);

    if (buy && liveState.position === 0 && positionSize > 0) {
      liveState.position = positionSize / price;
      liveState.entryPrice = price;
      liveState.balance -= positionSize;
      action = 'buy';
      liveState.tradesToday += 1;
      trade = {
        timestamp: isoStamp(),
        type: 'strategy',
        action,
        price,
        qty: Number(liveState.position.toFixed(8)),
        notional: Number(positionSize.toFixed(2)),
        balance: Number(liveState.balance.toFixed(2)),
        indicators
      };
    } else if (sell && liveState.position > 0) {
      const exitNotional = liveState.position * price;
      const entryNotional = liveState.position * liveState.entryPrice;
      const pnl = exitNotional - entryNotional;

      liveState.balance += exitNotional;
      liveState.pnlToday += pnl;
      action = 'sell';
      liveState.tradesToday += 1;

      trade = {
        timestamp: isoStamp(),
        type: 'strategy',
        action,
        price,
        qty: Number(liveState.position.toFixed(8)),
        pnl: Number(pnl.toFixed(2)),
        balance: Number(liveState.balance.toFixed(2)),
        indicators
      };

      liveState.position = 0;
      liveState.entryPrice = null;
    }

    // Try arbitrage each cycle (lightweight)
    let arbTrade = null;
    try {
      arbTrade = await maybeExecuteArbitrage();
    } catch (e) {
      console.warn('Arbitrage attempt failed:', e.message);
    }

    liveState.lastRun = isoStamp();
    liveState.lastAction = action || 'hold';
    liveState.cycles += 1;
    liveState.lastError = null;

    if (trade) appendLiveTrade(trade);
    saveLiveStatus({ price, indicators, action, lastArbitrage: liveState.arb.last || null, arbEnabled: arbConfig.enabled });
  } catch (err) {
    liveState.lastError = err.message;
    liveState.lastRun = isoStamp();
    liveState.lastAction = 'error';
    saveLiveStatus();
    console.error('Live cycle error:', err.message);
  }
}

/* Live controls */

app.post('/api/live-start', (req, res) => {
  const { intervalMs, startingCash, maxDailyLoss, maxPosition, cooldownMs } = req.body || {};
  if (liveState.running) return res.status(400).json({ error: 'Live already running' });

  liveState.intervalMs = Number(intervalMs || liveState.intervalMs);
  liveState.startingCash = Number(startingCash || liveState.startingCash);
  liveState.balance = liveState.startingCash;
  liveState.position = 0;
  liveState.entryPrice = null;
  liveState.lastAction = 'idle';
  liveState.lastError = null;
  liveState.lastRun = null;
  liveState.cycles = 0;
  liveState.tradesToday = 0;
  liveState.pnlToday = 0;
  liveState.maxDailyLoss = Number(maxDailyLoss ?? liveState.maxDailyLoss);
  liveState.maxPosition = Number(maxPosition ?? liveState.maxPosition);
  liveState.cooldownMs = Number(cooldownMs || 0);
  liveState.nextAllowedTs = Date.now();

  if (global.liveTimer) clearInterval(global.liveTimer);
  global.liveTimer = setInterval(runLiveCycle, liveState.intervalMs);
  liveState.running = true;

  saveLiveStatus();
  res.json({ ok: true, live: liveState, arbConfig });
});

app.post('/api/live-stop', (req, res) => {
  if (global.liveTimer) clearInterval(global.liveTimer);
  global.liveTimer = null;
  liveState.running = false;
  liveState.lastAction = 'stopped';
  saveLiveStatus();
  res.json({ ok: true, live: liveState });
});

app.get('/api/live-status', (req, res) => {
  try {
    if (fs.existsSync(LIVE_STATUS_PATH)) {
      const status = JSON.parse(fs.readFileSync(LIVE_STATUS_PATH, 'utf8'));
      return res.json(status);
    }
  } catch {}
  res.json({ ...liveState, timestamp: isoStamp(), arbConfig });
});

app.get('/api/live-trades', (req, res) => {
  try {
    if (fs.existsSync(LIVE_TRADES_PATH)) {
      return res.json(JSON.parse(fs.readFileSync(LIVE_TRADES_PATH, 'utf8')));
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load live trades' });
  }
});

/* ============================ */
/* Boot                         */
/* ============================ */

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SentinelSniper backend listening on port ${PORT}`);
});