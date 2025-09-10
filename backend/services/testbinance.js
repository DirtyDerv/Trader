const { fetchBinanceData } = require('./binance');

fetchBinanceData('BTCUSDT', '1m', 100).then(data => {
  console.log('Candles:', data.length);
  console.log('Sample:', data[0]);
}).catch(err => {
  console.error('Error:', err.message);
});