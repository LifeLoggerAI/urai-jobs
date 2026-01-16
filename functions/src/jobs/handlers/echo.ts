
import { logger } from 'firebase-functions';

export async function echo(payload: any): Promise<void> {
    logger.info('ECHO PAYLOAD:', payload);
}
