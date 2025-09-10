const fs = require('fs');
const path = require('path');

function evaluateCondition(condition, indicators) {
  const safeKeys = Object.keys(indicators);
  const safeValues = Object.values(indicators);

  try {
    const fn = new Function(...safeKeys, `return ${condition};`);
    return fn(...safeValues);
  } catch (err) {
    console.error('Condition evaluation error:', err.message);
    return false;
  }
}

function executeStrategy(snapshot) {
  const strategyPath = path.join(__dirname, '../strategy.json');
  let strategy;

  try {
    const raw = fs.readFileSync(strategyPath, 'utf8');
    strategy = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load strategy:', err.message);
    return { error: 'Strategy file missing or invalid' };
  }

  const indicators = {};

  for (const module of strategy.modules) {
    const { type, params } = module;

    if (type === 'RSI') {
      const closes = snapshot.binance.map(c => parseFloat(c.close));
      const period = params.period || 14;
      const rsi = calculateRSI(closes, period);
      indicators.RSI = rsi;
    }

    if (type === 'SentimentFilter') {
      indicators.Sentiment = snapshot.reddit.sentiment;
    }

    // You can add EMA, MACD, etc. here later
  }

  const logicModule = strategy.modules.find(m => m.type === 'ExecutionLogic');
  if (!logicModule) return { error: 'No ExecutionLogic found' };

  const { buy, sell } = logicModule.params;

  const shouldBuy = evaluateCondition(buy, indicators);
  const shouldSell = evaluateCondition(sell, indicators);

  return {
    indicators,
    decision: shouldBuy ? 'BUY' : shouldSell ? 'SELL' : 'HOLD'
  };
}

// Simple RSI calculator
function calculateRSI(closes, period) {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta;
    else losses -= delta;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

module.exports = { executeStrategy };