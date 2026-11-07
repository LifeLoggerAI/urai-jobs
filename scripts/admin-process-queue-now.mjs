/** R887: permanently retired raw production queue drain.
 * The prior direct Admin SDK/gcloud implementation remains in Git history
 * for forensic review, but must not bypass current owner/consent/lease fences.
 */
import { refuseLegacyManualQueueDrain } from './legacy-admin-writer-gate.mjs';
refuseLegacyManualQueueDrain();
