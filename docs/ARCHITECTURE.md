# Architecture

## System Overview

```
┌─────────────────────┐     HTTPS + Firebase Token     ┌─────────────────────────┐
│   Next.js Frontend  │ ──────────────────────────────► │   Express REST API      │
│   (Vercel)          │ ◄────────────────────────────── │   (Google Cloud Run)    │
└─────────────────────┘                                 └─────────┬───────────────┘
                                                                  │
                    ┌─────────────────────────────────────────────┼──────────────────┐
                    │                 Google Cloud                 │                  │
                    │  ┌──────────┐  ┌───────────────┐  ┌────────┴────────┐         │
                    │  │ Firestore│  │ Secret Manager│  │ Cloud Logging   │         │
                    │  └──────────┘  └───────────────┘  └─────────────────┘         │
                    └──────────────────────────────────────────────────────────────────┘
                                                                  │
                    ┌─────────────────────────────────────────────┼──────────────────┐
                    │              External Services              │                  │
                    │  ┌──────────────┐  ┌───────────┐  ┌────────┴────────┐         │
                    │  │ YouTube API  │  │ SendGrid  │  │ Google Sheets   │         │
                    │  │ Data v3      │  │           │  │ API             │         │
                    │  └──────────────┘  └───────────┘  └─────────────────┘         │
                    └──────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Discovery Pipeline
1. User submits filters → `POST /api/channels/discover`
2. Backend searches YouTube (search.list, type=channel)
3. For each candidate channel:
   - Fetch subscriber count (channels.list)
   - Fetch last 30 videos (search.list → videos.list)
   - Calculate average views
   - Extract email from description (regex)
4. Apply sequential filters (subs → views → keyword → email)
5. Stop at target count (30–50)
6. Save to Firestore + append to Google Sheet

### Email Pipeline
1. User selects campaign + channels → `POST /api/emails/send`
2. Backend personalizes templates with `{{channelName}}`, `{{subscribers}}`, `{{avgViews}}`
3. Sends via SendGrid with 200ms delay between sends
4. Updates Firestore: `emailSent=true`, `emailSentDate`
5. Increments campaign counters + logs activity

## Security
- Firebase ID token verification on all protected routes
- CORS restricted to frontend domain
- Helmet security headers
- Rate limiting (100/15min general, 10/min trigger)
- Input validation on all endpoints
- API keys in Google Secret Manager (never in code)
- Duplicate prevention via channelId as Firestore doc ID

## Firestore Collections
- **channels** — discovered YouTube channels with stats + email
- **campaigns** — email campaign definitions
- **activityLogs** — audit trail of all actions
- **analytics** — precomputed global counters (single document)
