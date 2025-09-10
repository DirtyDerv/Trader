const axios = require('axios');

async function fetchRedditSentiment(subreddit = 'cryptocurrency', limit = 25) {
  const url = `https://www.reddit.com/r/${subreddit}/new.json?limit=${limit}`;

  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'SentinelSniper/1.0' }
    });

    const posts = res.data.data.children.map(post => post.data.title + ' ' + post.data.selftext);

    let score = 0;
    let total = 0;

    for (const text of posts) {
      const lower = text.toLowerCase();
      if (lower.includes('bullish') || lower.includes('buy') || lower.includes('moon')) score += 1;
      if (lower.includes('bearish') || lower.includes('sell') || lower.includes('crash')) score -= 1;
      total++;
    }

    const sentiment = total > 0 ? score / total : 0;
    return { subreddit, sentiment };
  } catch (err) {
    console.error('Reddit sentiment fetch error:', err.message);
    return { subreddit, sentiment: 0 };
  }
}

module.exports = { fetchRedditSentiment };