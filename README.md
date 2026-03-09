# YouTube Creator Discovery & Outreach Automation System

A production-grade, Google Cloud–native SaaS platform for discovering YouTube creators, filtering by engagement metrics, and automating personalized email outreach.

## Features

- **YouTube Discovery** — Search channels by keyword, filter by subscriber count and average views
- **Email Extraction** — Regex-based email detection from public channel descriptions
- **Email Outreach** — Personalized bulk emails via SendGrid with template variables
- **Google Sheets** — Automatic data export with service account authentication
- **Dashboard** — Real-time analytics, campaign management, and sync status
- **Security** — Firebase Auth, Secret Manager, rate limiting, CORS, Helmet

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 (App Router) |
| Backend | Node.js + Express |
| Database | Google Firestore |
| Auth | Firebase Authentication |
| Hosting | Vercel (frontend), Cloud Run (backend) |
| Email | SendGrid API |
| Sheets | Google Sheets API |
| Secrets | Google Secret Manager |
| Logging | Google Cloud Logging + Winston |

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env    # Fill in your API keys
npm install
npm run dev             # http://localhost:8080
```

### Frontend
```bash
cd frontend
npm install
npm run dev             # http://localhost:3000
```

Set environment variables in `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

## Documentation

- [Deployment Guide](docs/DEPLOYMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Cost Estimation](docs/COST_ESTIMATION.md)

## Project Structure

```
youtube/
├── backend/           # Express REST API
│   ├── src/
│   │   ├── config/    # Firestore, Secret Manager, Logger
│   │   ├── middleware/ # Auth, rate limiting, validation
│   │   ├── routes/    # REST endpoints
│   │   └── services/  # YouTube, Email, Sheets, Filter Engine
│   └── Dockerfile
├── frontend/          # Next.js App Router
│   └── src/
│       ├── app/       # Pages (login, dashboard/*)
│       ├── components/ # Sidebar, Header, Charts, Tables
│       └── lib/       # Firebase, API client
└── docs/              # Deployment, Architecture, Costs
```

## License

Private — All rights reserved.
