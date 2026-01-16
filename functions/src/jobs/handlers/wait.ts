
import { logger } from 'firebase-functions';

export async function wait(payload: any): Promise<void> {
    const ms = payload.ms || 1000;
    logger.info(`Waiting for ${ms}ms...`);
    await new Promise(resolve => setTimeout(resolve, ms));
    logger.info('Wait complete.');
}
