const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', 'trade-log.json');

function logSentiment(post, score) {
  const entry = {
    timestamp: new Date().toISOString(),
    post,
    score
  };

  let log = [];
  if (fs.existsSync(LOG_PATH)) {
    try {
      log = JSON.parse(fs.readFileSync(LOG_PATH));
    } catch (err) {
      console.error('Log parse error:', err.message);
    }
  }

  log.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

module.exports = { logSentiment };