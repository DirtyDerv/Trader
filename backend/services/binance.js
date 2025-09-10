const axios = require('axios');

async function fetchBinanceData(symbol = 'BTCUSDT', interval = '1m', limit = 100) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  try {
    const res = await axios.get(url);
    return res.data.map(candle => ({
      openTime: candle[0],
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5]),
      closeTime: candle[6]
    }));
  } catch (err) {
    console.error('Binance fetch error:', err.message);
    return [];
  }
}

module.exports = { fetchBinanceData };