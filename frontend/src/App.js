import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Container,
  Typography,
  Box,
  Button,
  Grid,
  Paper,
  TextField,
  CircularProgress
} from '@mui/material';

const API_BASE_URL = 'http://localhost:4000/api';

function ModuleEditor({ module, onChange }) {
  const [params, setParams] = useState(module.params);

  const handleChange = (key, value) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    onChange({ ...module, params: newParams });
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6">{module.type}</Typography>
      {Object.entries(params).map(([key, value]) => (
        <TextField
          key={key}
          label={key}
          value={value}
          onChange={e => handleChange(key, e.target.value)}
          sx={{ m: 1, width: 'calc(100% - 16px)' }}
          variant="outlined"
        />
      ))}
    </Paper>
  );
}

export default function App() {
  const [strategy, setStrategy] = useState(null);
  const [tradeLogs, setTradeLogs] = useState([]);
  const [sentimentFeed, setSentimentFeed] = useState([]);
  const [simulationResult, setSimulationResult] = useState(null);
  const [tradeCount, setTradeCount] = useState(null);
  const [loading, setLoading] = useState({
    strategy: true,
    logs: true,
    sentiment: true,
    saving: false,
    simulating: false
  });

  const fetchData = async () => {
    try {
      setLoading(prev => ({ ...prev, strategy: true, logs: true, sentiment: true }));
      const [strat, logs, sentiment] = await Promise.all([
        axios.get(`${API_BASE_URL}/strategy`),
        axios.get(`${API_BASE_URL}/trade-logs`),
        axios.get(`${API_BASE_URL}/sentiment-feed`)
      ]);
      setStrategy(strat.data);
      setTradeLogs(logs.data);
      setSentimentFeed(sentiment.data);
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(prev => ({ ...prev, strategy: false, logs: false, sentiment: false }));
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/metrics`);
      const match = res.data.match(/trade_count\s+(\d+)/);
      if (match) setTradeCount(Number(match[1]));
    } catch (err) {
      console.error('Failed to fetch metrics', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleModuleChange = (idx, newModule) => {
    const newModules = [...strategy.modules];
    newModules[idx] = newModule;
    setStrategy({ ...strategy, modules: newModules });
  };

  const handleSave = async () => {
    setLoading(prev => ({ ...prev, saving: true }));
    try {
      await axios.post(`${API_BASE_URL}/strategy`, strategy);
    } catch (error) {
      console.error("Failed to save strategy", error);
    } finally {
      setLoading(prev => ({ ...prev, saving: false }));
    }
  };

  const handleSimulate = async () => {
    setLoading(prev => ({ ...prev, simulating: true }));
    try {
      const res = await axios.post(`${API_BASE_URL}/simulate`, { strategy, data: [] });
      setSimulationResult(res.data);
    } catch (error) {
      console.error("Failed to run simulation", error);
    } finally {
      setLoading(prev => ({ ...prev, simulating: false }));
    }
  };

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" sx={{ mt: 4, mb: 2 }}>SentinelSniper Dashboard</Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Typography variant="h5">Strategy Editor</Typography>
          {loading.strategy ? <CircularProgress /> : strategy && strategy.modules.map((mod, idx) => (
            <ModuleEditor
              key={idx}
              module={mod}
              onChange={(newModule) => handleModuleChange(idx, newModule)}
            />
          ))}
          <Button variant="contained" onClick={handleSave} disabled={loading.saving} sx={{ mr: 1 }}>
            {loading.saving ? <CircularProgress size={24} /> : 'Save Strategy'}
          </Button>
          <Button variant="outlined" onClick={handleSimulate} disabled={loading.simulating}>
            {loading.simulating ? <CircularProgress size={24} /> : 'Run Simulation'}
          </Button>
          {simulationResult && (
            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6">Simulation Results</Typography>
              <pre>{JSON.stringify(simulationResult, null, 2)}</pre>
            </Paper>
          )}
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6">Live Metrics</Typography>
            <Typography>Trades Executed: {tradeCount !== null ? tradeCount : 'Loading...'}</Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Trade Logs</Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {loading.logs ? <CircularProgress /> : tradeLogs.length === 0 ? 'No trades yet.' :
                tradeLogs.map((log, i) => <pre key={i}>{JSON.stringify(log)}</pre>)}
            </Box>
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Sentiment Feed</Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {loading.sentiment ? <CircularProgress /> : sentimentFeed.length === 0 ? 'No sentiment data.' :
                sentimentFeed.map((item, i) => <pre key={i}>{JSON.stringify(item, null, 2)}</pre>)}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}