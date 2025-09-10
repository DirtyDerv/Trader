const { fetchBinanceData } = require('./binance');
const { calculateRSI } = require('./indicators');
const { fetchRedditSentiment } = require('./redditSentiment');

async function getUnifiedMarketSnapshot() {
  try {
    // Fetch market data
    const binance = await fetchBinanceData('BTCUSDT', '1m', 100);
    const rsi = calculateRSI(binance, 14);

    // Fetch sentiment from Reddit using Gemma3
    const reddit = await fetchRedditSentiment();

    return {
      RSI: rsi,
      Sentiment: reddit.sentiment
    };
  } catch (err) {
    console.error('Snapshot error:', err.message);
    return {
      RSI: null,
      Sentiment: null
    };
  }
}

module.exports = { getUnifiedMarketSnapshot };