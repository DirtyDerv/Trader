function calculateRSI(candles, period = 14) {
  if (candles.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const delta = candles[i].close - candles[i - 1].close;
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));

  return parseFloat(rsi.toFixed(2));
}

module.exports = { calculateRSI };