// ─── Secret loading ──────────────────────────────────────────────────────────
// On GCP (GOOGLE_CLOUD_PROJECT is set) we use Secret Manager.
// On Vercel / other hosts we read directly from environment variables.
// ─────────────────────────────────────────────────────────────────────────────

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

let _smClient = null;
const cache = {};

function getSmClient() {
    if (!_smClient) {
        _smClient = new SecretManagerServiceClient();
    }
    return _smClient;
}

async function getSecretFromGcp(secretName) {
    if (cache[secretName]) return cache[secretName];

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

    const client = getSmClient();
    const [version] = await client.accessSecretVersion({ name });
    const value = version.payload.data.toString('utf8');
    cache[secretName] = value;
    return value;
}

async function loadSecrets() {
    const isGcp = !!process.env.GOOGLE_CLOUD_PROJECT;
    const secrets = {};

    if (isGcp) {
        // Running on GCP — use Secret Manager with env-var fallback
        secrets.youtubeApiKey = await getSecretFromGcp(
            process.env.SECRET_YOUTUBE_API_KEY || 'youtube-api-key'
        ).catch(() => process.env.YOUTUBE_API_KEY || '');

        secrets.sendgridApiKey = await getSecretFromGcp(
            process.env.SECRET_SENDGRID_API_KEY || 'sendgrid-api-key'
        ).catch(() => process.env.SENDGRID_API_KEY || '');

        secrets.sheetsCredentials = await getSecretFromGcp(
            process.env.SECRET_SHEETS_CREDENTIALS || 'sheets-service-account'
        ).catch(() => process.env.GOOGLE_SHEETS_CREDENTIALS || null);
    } else {
        // Running on Vercel / local — read directly from env vars
        secrets.youtubeApiKey = process.env.YOUTUBE_API_KEY || '';
        secrets.sendgridApiKey = process.env.SENDGRID_API_KEY || '';
        secrets.sheetsCredentials = process.env.GOOGLE_SHEETS_CREDENTIALS || null;
    }

    return secrets;
}

export { loadSecrets };
