const axios = require('axios');

async function fetchRedditSentiment() {
  try {
    const response = await axios.post('http://192.168.0.14:11434/api/generate', {
      model: 'phi3:mini', // or 'phi3:mini:Q4_K_M' if you're using quantized
      prompt: `Rate the sentiment of this crypto post from -1 (very negative) to +1 (very positive):\n\n"Bitcoin is pumping hard today!"`,
      stream: false
    });

    const match = response.data?.response?.match(/-?\d+(\.\d+)?/);
    const sentiment = match ? parseFloat(match[0]) : 0;

    return { sentiment };
  } catch (err) {
    console.error('Ollama error:', err.message);
    return { sentiment: 0 }; // fallback value
  }
}

module.exports = { fetchRedditSentiment };