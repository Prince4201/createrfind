import admin from 'firebase-admin';
import logger from './logger.js';

// ═══════════════════════════════════════════════════════════
//  Firebase Admin SDK — Singleton initialization
//  • Service Account JSON from env var (local/dev)
//  • Falls back to Application Default Credentials (GCP)
//  • Exports admin, db (Firestore), and auth instances
// ═══════════════════════════════════════════════════════════

function initializeFirebase() {
    if (admin.apps.length) {
        return admin; // Already initialized
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccountJson) {
        try {
            const creds =
                typeof serviceAccountJson === 'string'
                    ? JSON.parse(serviceAccountJson)
                    : serviceAccountJson;

            admin.initializeApp({
                credential: admin.credential.cert(creds),
            });

            logger.info('Firebase Admin initialized with service account', {
                projectId: creds.project_id,
                serviceAccount: creds.client_email,
            });
        } catch (error) {
            logger.error('Failed to parse Firebase service account JSON', {
                error: error.message,
            });
            // Fall back to project ID
            _initWithProjectId();
        }
    } else {
        _initWithProjectId();
    }

    return admin;
}

function _initWithProjectId() {
    const projectId =
        process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

    if (projectId) {
        admin.initializeApp({ projectId });
        logger.info('Firebase Admin initialized with project ID (no service account)', {
            projectId,
        });
    } else {
        admin.initializeApp();
        logger.warn(
            'Firebase Admin initialized without credentials — set FIREBASE_SERVICE_ACCOUNT env var for full functionality'
        );
    }
}

// Initialize on import
initializeFirebase();

const db = admin.firestore();
const auth = admin.auth();

export { admin, db, auth };
export default admin;
