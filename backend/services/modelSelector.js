const { execSync } = require('child_process');

function isGPUAvailable() {
  try {
    const output = execSync('nvidia-smi', { encoding: 'utf8' });
    return output.includes('NVIDIA');
  } catch (err) {
    return false;
  }
}

function getModelName() {
  if (isGPUAvailable()) {
    console.log('[Ollama] GPU detected — using full model');
    return 'phi3:mini';
  } else {
    console.log('[Ollama] No GPU — using quantized fallback');
    return 'phi3:mini:Q4_K_M';
  }
}

module.exports = { getModelName };