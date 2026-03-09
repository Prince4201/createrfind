import { db } from './firebaseAdmin.js';
import logger from './logger.js';

// ═══════════════════════════════════════════════════════════
//  Firestore Collection Initialization
//  Ensures required collections exist by checking for at
//  least one document. Creates a sentinel doc if empty.
// ═══════════════════════════════════════════════════════════

const REQUIRED_COLLECTIONS = ['users', 'channels', 'campaigns', 'emailLogs'];

/**
 * Ensure all required Firestore collections exist.
 * Firestore collections don't exist until they have at least one document,
 * so we create a lightweight _meta doc in any empty collection.
 */
async function initCollections() {
    try {
        for (const name of REQUIRED_COLLECTIONS) {
            const snapshot = await db.collection(name).limit(1).get();

            if (snapshot.empty) {
                await db.collection(name).doc('_meta').set({
                    _createdAt: new Date(),
                    _description: `Auto-created to initialize the ${name} collection`,
                });
                logger.info(`Firestore: created collection "${name}" with _meta doc`);
            }
        }

        logger.info('Firestore collections initialized', {
            collections: REQUIRED_COLLECTIONS,
        });
    } catch (error) {
        logger.error('Failed to initialize Firestore collections', {
            error: error.message,
        });
        // Non-fatal — server can still start without pre-created collections
    }
}

export { initCollections, REQUIRED_COLLECTIONS };
export default initCollections;
