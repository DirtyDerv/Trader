const { fetchBinanceData } = require('./binance');
const { calculateRSI } = require('./indicators');
const { fetchRedditSentiment } = require('./redditSentiment');

async function getUnifiedMarketSnapshot() {
  try {
    const binance = await fetchBinanceData('BTCUSDT', '1m', 20);
    const lastCandle = binance[binance.length - 1];

    const rsi = calculateRSI(binance, 14);
    const reddit = await fetchRedditSentiment();

    return {
      price: Number(lastCandle.close),
      RSI: typeof rsi === 'number' ? rsi : 0,
      Sentiment: typeof reddit.sentiment === 'number' ? reddit.sentiment : 0
    };
  } catch (err) {
    console.error('Snapshot error:', err.message);
    return {
      price: null,
      RSI: 0,
      Sentiment: 0
    };
  }
}

module.exports = { getUnifiedMarketSnapshot };