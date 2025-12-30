
import { noopPing } from './noop.ping';
import { firestoreWrite } from './firestore.write';
import { maintenanceCompactLogs } from './maintenance.compactLogs';

export const handlers = {
  'noop.ping': noopPing,
  'firestore.write': firestoreWrite,
  'maintenance.compactLogs': maintenanceCompactLogs,
};
