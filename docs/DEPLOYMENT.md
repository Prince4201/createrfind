# Deployment Guide

## Prerequisites
- Google Cloud account with billing enabled
- Node.js 20+
- Docker (for Cloud Run)
- `gcloud` CLI installed and authenticated

---

## 1. Google Cloud Project Setup

```bash
gcloud projects create your-project-id
gcloud config set project your-project-id
gcloud services enable \
  firestore.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  youtube.googleapis.com \
  sheets.googleapis.com \
  logging.googleapis.com
```

---

## 2. Firestore Setup

```bash
gcloud firestore databases create --location=us-central1
```

Create composite indexes in the Firebase Console or via CLI:
- `channels`: `subscribers` ASC + `avgViews` DESC
- `channels`: `emailSent` ASC + `scrapedAt` DESC
- `channels`: `userId` ASC + `scrapedAt` DESC

---

## 3. YouTube Data API v3

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **API Key**
3. Restrict it to YouTube Data API v3
4. Store it in Secret Manager (see step 5)

---

## 4. Firebase Authentication

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Add your GCP project (or create a new Firebase project)
3. Enable **Email/Password** sign-in under Authentication → Sign-in method
4. Copy your Firebase web config (apiKey, authDomain, projectId, etc.)
5. Set these as `NEXT_PUBLIC_FIREBASE_*` env vars in the frontend

---

## 5. Secret Manager

Store all secrets:

```bash
echo -n "YOUR_YOUTUBE_API_KEY" | gcloud secrets create youtube-api-key --data-file=-
echo -n "YOUR_SENDGRID_API_KEY" | gcloud secrets create sendgrid-api-key --data-file=-
cat service-account.json | gcloud secrets create sheets-service-account --data-file=-
```

Grant Cloud Run service account access:

```bash
PROJECT_NUMBER=$(gcloud projects describe your-project-id --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding youtube-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Repeat for all secrets.

---

## 6. SendGrid Setup

1. Create a [SendGrid account](https://sendgrid.com)
2. Verify a sender identity (email or domain)
3. Create an API key with **Mail Send** permission
4. Store in Secret Manager (step 5)
5. Set `SENDGRID_FROM_EMAIL` and `SENDGRID_FROM_NAME` in Cloud Run env vars

---

## 7. Google Sheets Service Account

1. Go to [GCP Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Create a service account (e.g., `sheets-writer`)
3. Download the JSON key file
4. Store the JSON in Secret Manager as `sheets-service-account`
5. Create a Google Sheet and share it with the service account email
6. Set `GOOGLE_SHEET_ID` as a Cloud Run env var

---

## 8. Deploy Backend to Cloud Run

```bash
cd backend

# Build and push Docker image
gcloud builds submit --tag gcr.io/your-project-id/youtube-creator-backend

# Deploy
gcloud run deploy youtube-creator-backend \
  --image gcr.io/your-project-id/youtube-creator-backend \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=your-project-id,FRONTEND_URL=https://your-frontend.vercel.app,GOOGLE_SHEET_ID=your-sheet-id,SENDGRID_FROM_EMAIL=noreply@yourdomain.com,SENDGRID_FROM_NAME=CreatorFind"
```

---

## 9. Deploy Frontend to Vercel

```bash
cd frontend
npx vercel --prod
```

Set environment variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` = Cloud Run service URL
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

---

## 10. CORS Configuration

After deploying, update the backend `FRONTEND_URL` env var to match your Vercel domain:

```bash
gcloud run services update youtube-creator-backend \
  --update-env-vars "FRONTEND_URL=https://your-app.vercel.app"
```
