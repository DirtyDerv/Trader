# SentinelSniper Dashboard

A full-stack web app for loading, editing, and visualizing trading strategies, trade logs, and sentiment feeds.

## Features
- Load and edit JSON strategy files (modules: RSI, EMA, Sentiment Filter, Execution Logic)
- Dashboard for trade logs and sentiment feeds
- Node.js + Express backend
- React + Material UI frontend
- Dockerized for easy deployment

## Quick Start

### Development

1. Install dependencies:
   - Backend: `cd backend && npm install`
   - Frontend: `cd frontend && npm install`
2. Start servers:
   - Backend: `cd backend && npm start`
   - Frontend: `cd frontend && npm start`

### Docker

1. Build and run with Docker Compose:
   - `docker-compose up --build`

## File Structure
- `backend/` — Node.js Express API
- `frontend/` — React app

---

Replace sample strategy and logs with your own as needed.
