import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Container, Typography, Box, Button, Grid, Paper, TextField } from '@mui/material';

function ModuleEditor({ module, onChange }) {
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6">{module.type}</Typography>
      {Object.entries(module.params).map(([key, value]) => (
        <TextField
          key={key}
          label={key}
          value={value}
          onChange={e => onChange(key, e.target.value)}
          sx={{ m: 1 }}
        />
      ))}
    </Paper>
  );
}

export default function App() {
  const [strategy, setStrategy] = useState(null);
  const [tradeLogs, setTradeLogs] = useState([]);
  const [sentimentFeed, setSentimentFeed] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get('/api/strategy').then(res => setStrategy(res.data));
    axios.get('/api/trade-logs').then(res => setTradeLogs(res.data));
    axios.get('/api/sentiment-feed').then(res => setSentimentFeed(res.data));
  }, []);

  const handleModuleChange = (idx, key, value) => {
    const newModules = [...strategy.modules];
    newModules[idx].params[key] = value;
    setStrategy({ ...strategy, modules: newModules });
  };

  const handleSave = async () => {
    setSaving(true);
    await axios.post('/api/strategy', strategy);
    setSaving(false);
  };

  if (!strategy) return <div>Loading...</div>;

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" sx={{ mt: 4, mb: 2 }}>SentinelSniper Dashboard</Typography>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5">Strategy Editor</Typography>
        {strategy.modules.map((mod, idx) => (
          <ModuleEditor
            key={idx}
            module={mod}
            onChange={(key, value) => handleModuleChange(idx, key, value)}
          />
        ))}
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Strategy'}
        </Button>
      </Box>
      <Grid container spacing={4}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Trade Logs</Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {tradeLogs.length === 0 ? 'No trades yet.' : tradeLogs.map((log, i) => (
                <Box key={i} sx={{ mb: 1 }}>{JSON.stringify(log)}</Box>
              ))}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6">Sentiment Feed</Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {sentimentFeed.length === 0 ? 'No sentiment data.' : sentimentFeed.map((item, i) => (
                <Box key={i} sx={{ mb: 1 }}>{JSON.stringify(item)}</Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
