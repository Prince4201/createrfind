// ═══════════════════════════════════════════════════════════
//  Firestore re-export — backward-compatible module
//  All existing imports like:
//    import { admin, db } from '../config/firestore.js'
//  continue to work without any changes.
// ═══════════════════════════════════════════════════════════

export { admin, db, auth } from './firebaseAdmin.js';
