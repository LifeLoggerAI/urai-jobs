import { noopPing } from "./noopPing";
import { firestoreWrite } from "./firestoreWrite";
import { maintenanceCompactLogs } from "./maintenanceCompactLogs";

export const handlers = {
    "noop.ping": noopPing,
    "firestore.write": firestoreWrite,
    "maintenance.compactLogs": maintenanceCompactLogs,
};
