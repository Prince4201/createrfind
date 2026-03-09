import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const cache = {};

async function getSecret(secretName) {
    if (cache[secretName]) return cache[secretName];

    // In local development, fall back to env vars
    if (process.env.NODE_ENV !== 'production') {
        const envVal = process.env[secretName];
        if (envVal) return envVal;
    }

    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

    const [version] = await client.accessSecretVersion({ name });
    const value = version.payload.data.toString('utf8');
    cache[secretName] = value;
    return value;
}

async function loadSecrets() {
    const secrets = {};

    secrets.youtubeApiKey = await getSecret(
        process.env.SECRET_YOUTUBE_API_KEY || 'youtube-api-key'
    ).catch(() => process.env.YOUTUBE_API_KEY || '');

    secrets.sendgridApiKey = await getSecret(
        process.env.SECRET_SENDGRID_API_KEY || 'sendgrid-api-key'
    ).catch(() => process.env.SENDGRID_API_KEY || '');

    secrets.sheetsCredentials = await getSecret(
        process.env.SECRET_SHEETS_CREDENTIALS || 'sheets-service-account'
    ).catch(() => process.env.GOOGLE_SHEETS_CREDENTIALS || null);

    return secrets;
}

export { getSecret, loadSecrets };
