// services/arbitrageScanner.js
// Lightweight cross-exchange price scanner with normalization and fee-aware spreads.
// Uses Node 18+ global fetch.

const FEES = {
  binance: { taker: 0.0010 },
  kraken:  { taker: 0.0026 },
  coinbase:{ taker: 0.0060 }, // retail spot is pricey; adjust if you have Advanced
  bitstamp:{ taker: 0.0050 },
  kucoin:  { taker: 0.0010 }
};

function toPair(symbol, quote) {
  return { symbol: symbol.toUpperCase(), quote: quote.toUpperCase() };
}

async function getBinance(symbol, quote) {
  // e.g., BTC USDT -> BTCUSDT
  const pair = `${symbol}${quote}`;
  const url = `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!j || !j.price) throw new Error('Binance price missing');
  return Number(j.price);
}

async function getKraken(symbol, quote) {
  // Kraken uses XBT for BTC and ZUSD for USD
  const s = symbol === 'BTC' ? 'XBT' : symbol;
  const q = quote === 'USD' ? 'USD' : quote;
  const pair = `${s}${q}`; // e.g., XBTUSDT or XBTUSD
  const url = `https://api.kraken.com/0/public/Ticker?pair=${pair}`;
  const r = await fetch(url);
  const j = await r.json();
  const key = Object.keys(j.result || {})[0];
  const a = j.result?.[key]?.c?.[0];
  if (!a) throw new Error('Kraken price missing');
  return Number(a);
}

async function getCoinbase(symbol, quote) {
  // Coinbase uses BTC-USD
  const pair = `${symbol}-${quote}`;
  const url = `https://api.coinbase.com/v2/prices/${pair}/spot`;
  const r = await fetch(url);
  const j = await r.json();
  const amt = j?.data?.amount;
  if (!amt) throw new Error('Coinbase price missing');
  return Number(amt);
}

async function getBitstamp(symbol, quote) {
  // Bitstamp uses lowercase: btcusd
  const pair = `${symbol}${quote}`.toLowerCase();
  const url = `https://www.bitstamp.net/api/v2/ticker/${pair}`;
  const r = await fetch(url);
  const j = await r.json();
  if (!j || !j.last) throw new Error('Bitstamp price missing');
  return Number(j.last);
}

async function getKucoin(symbol, quote) {
  // KuCoin uses BTC-USDT
  const pair = `${symbol}-${quote}`;
  const url = `https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${pair}`;
  const r = await fetch(url);
  const j = await r.json();
  const p = j?.data?.price;
  if (!p) throw new Error('KuCoin price missing');
  return Number(p);
}

async function scanArbitrage({ symbol = 'BTC', quote = 'USDT' } = {}) {
  const { symbol: S, quote: Q } = toPair(symbol, quote);

  const tasks = [
    ['binance', getBinance(S, Q), FEES.binance.taker],
    ['kraken',  getKraken(S, Q),  FEES.kraken.taker],
    ['coinbase',getCoinbase(S, Q),FEES.coinbase.taker],
    ['bitstamp',getBitstamp(S, Q),FEES.bitstamp.taker],
    ['kucoin',  getKucoin(S, Q),  FEES.kucoin.taker]
  ];

  const prices = {};
  const feeMap = {};
  const errors = {};

  await Promise.all(tasks.map(async ([name, p, fee]) => {
    try {
      const price = await p;
      prices[name] = price;
      feeMap[name] = fee;
    } catch (e) {
      errors[name] = e.message;
    }
  }));

  const venues = Object.keys(prices);
  const opportunities = [];

  for (let i = 0; i < venues.length; i++) {
    for (let j = 0; j < venues.length; j++) {
      if (i === j) continue;
      const buyEx = venues[i];
      const sellEx = venues[j];
      const buy = prices[buyEx];
      const sell = prices[sellEx];
      if (!buy || !sell) continue;

      const grossPct = (sell - buy) / buy; // e.g., 0.002 = 0.2%
      const estFees = feeMap[buyEx] + feeMap[sellEx]; // taker+taker
      const netPct = grossPct - estFees;

      opportunities.push({
        path: { buy: buyEx, sell: sellEx },
        buyPrice: buy,
        sellPrice: sell,
        grossPct: Number((grossPct * 100).toFixed(4)),
        estFeesPct: Number((estFees * 100).toFixed(4)),
        netPct: Number((netPct * 100).toFixed(4))
      });
    }
  }

  opportunities.sort((a, b) => b.netPct - a.netPct);

  return {
    symbol: S,
    quote: Q,
    prices,
    fees: feeMap,
    best: opportunities[0] || null,
    top: opportunities.slice(0, 10),
    errors
  };
}

module.exports = { scanArbitrage, FEES };