
import { echoHandler, waitHandler } from "./demo_jobs";

// A registry of job handlers, mapping job type to a handler function.
export const jobHandlers: Record<string, (payload: any) => Promise<void>> = {
    echo: echoHandler,
    wait: waitHandler,
};
