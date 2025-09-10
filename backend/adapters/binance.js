const axios = require('axios');

async function fetchBinanceData(symbol = 'BTCUSDT', interval = '1m', limit = 10) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  try {
    const res = await axios.get(url);
    return res.data.map(([time, open, high, low, close, volume]) => ({
      time,
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume)
    }));
  } catch (err) {
    console.error('Binance fetch error:', err.message);
    return [];
  }
}

module.exports = { fetchBinanceData };