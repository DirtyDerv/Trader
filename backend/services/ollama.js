const axios = require('axios');

const OLLAMA_HOST = 'http://192.168.0.14:11434';

async function analyzeTextWithOllama(post) {
  try {
    const prompt = `Rate the sentiment from -1 to 1. Respond with a single number only:\n\n${post}`;

    const res = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model: 'phi3:mini',
      prompt,
      stream: false
    });

    const match = res.data.response.match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  } catch (err) {
    console.error('Ollama error:', err.message);
    return null;
  }
}

module.exports = { analyzeTextWithOllama };