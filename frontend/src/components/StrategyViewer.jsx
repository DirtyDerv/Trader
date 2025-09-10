import React, { useEffect, useState } from 'react';

const StrategyViewer = () => {
  const [strategy, setStrategy] = useState([]);
  const [tradeCount, setTradeCount] = useState(null);

  useEffect(() => {
    fetch('/api/strategy')
      .then(res => res.json())
      .then(data => setStrategy(data.modules))
      .catch(err => console.error('Strategy fetch error:', err));

    const fetchMetrics = () => {
      fetch('/api/metrics')
        .then(res => res.text())
        .then(text => {
          const match = text.match(/trade_count\s+(\d+)/);
          if (match) setTradeCount(Number(match[1]));
        })
        .catch(err => console.error('Metrics fetch error:', err));
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>SentinelSniper Strategy</h2>
      <ul>
        {strategy.map((mod, i) => (
          <li key={i}>
            <strong>{mod.type}</strong>: {JSON.stringify(mod.params)}
          </li>
        ))}
      </ul>
      <h3>Trades Executed: {tradeCount !== null ? tradeCount : 'Loading...'}</h3>
    </div>
  );
};

export default StrategyViewer;