import { https, setGlobalOptions } from 'firebase-functions/v2';

setGlobalOptions({ maxInstances: 2 });

export * from './triggers/onJobWrite';
export * from './triggers/onApplicationCreate';
export * from './api/admin';
export * from './api/health';
export * from './scheduled/dailyDigest';
