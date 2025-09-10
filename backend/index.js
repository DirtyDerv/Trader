const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const STRATEGY_PATH = path.join(__dirname, 'strategy.json');
const TRADE_LOG_PATH = path.join(__dirname, 'trade-log.json');
const SENTIMENT_FEED_PATH = path.join(__dirname, 'sentiment-feed.json');

app.use(cors());
app.use(bodyParser.json());

// Load strategy JSON
app.get('/api/strategy', async (req, res) => {
  try {
    const data = await fs.readJson(STRATEGY_PATH);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: 'Strategy file not found.' });
  }
});

// Save strategy JSON
app.post('/api/strategy', async (req, res) => {
  try {
    await fs.writeJson(STRATEGY_PATH, req.body, { spaces: 2 });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save strategy.' });
  }
});

// Trade logs
app.get('/api/trade-logs', async (req, res) => {
  try {
    const data = await fs.readJson(TRADE_LOG_PATH);
    res.json(data);
  } catch (err) {
    res.json([]);
  }
});

// Sentiment feeds
app.get('/api/sentiment-feed', async (req, res) => {
  try {
    const data = await fs.readJson(SENTIMENT_FEED_PATH);
    res.json(data);
  } catch (err) {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`SentinelSniper backend running on port ${PORT}`);
});
