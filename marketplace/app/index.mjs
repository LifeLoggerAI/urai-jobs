export {createProfileClient,firebaseProfileSession} from './profile-client.mjs';
export {mountProfileEditor} from './profile-editor.mjs';

// Existing isolated route entry, not the superseded Jobs operator routes.
// No automatic Firebase app creation, generated config, consent receipts or
// launch bypass: an approved Career host must supply all bindings explicitly.
export async function mountCareerRoute(root,bindings,{pathname = globalThis.location?.pathname} = {}) {
  if (pathname !== '/candidate/profile') return null;
  const {mountProfileEditor} = await import('./profile-editor.mjs');
  return mountProfileEditor(root,bindings);
}
