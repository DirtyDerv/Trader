let isPaused = false;

function pauseExecution() {
  isPaused = true;
  console.log('[Control] Execution paused');
}

function resumeExecution() {
  isPaused = false;
  console.log('[Control] Execution resumed');
}

function getExecutionState() {
  return isPaused ? 'paused' : 'active';
}

function shouldExecute() {
  return !isPaused;
}

module.exports = {
  pauseExecution,
  resumeExecution,
  getExecutionState,
  shouldExecute
};