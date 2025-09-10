const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function fetchGeminiSentiment(text) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const prompt = `Rate the sentiment of this crypto market summary from -1 (very negative) to +1 (very positive). Return only the number:\n\n"${text}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response.text();

    const score = parseFloat(response.match(/-?\d+(\.\d+)?/)[0]);
    return { sentiment: score };
  } catch (err) {
    console.error('Gemini sentiment error:', err.message);
    return { sentiment: 0 };
  }
}

module.exports = { fetchGeminiSentiment };