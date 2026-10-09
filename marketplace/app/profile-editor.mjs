import {createProfileClient} from './profile-client.mjs';

const messages = {
  idle:'Load your saved profile to begin.',loading:'Loading your profile…',saving:'Saving and checking your profile…',
  'signed-out':'Sign in to manage your Career profile.',empty:'Create your Career profile.',ready:'Your saved profile is ready.',saved:'Profile saved and checked.',
  conflict:'Your profile changed elsewhere. Reload the saved profile before making another change.',
  'saved-unverified':'Your save was acknowledged, but the saved profile could not be checked. Reload before saving again.',
  'save-uncertain':'The save result could not be confirmed. Reload the saved profile before saving again.',
  'timed-out':'This request took too long. Reload the saved profile to check its current state.',
};
function errorMessage(code) {
  if (code === 'MARKETPLACE_LAUNCH_BLOCKED') return 'Career profiles are not available in this environment yet.';
  if (code === 'PROFILE_INPUT_INVALID') return 'Enter a name and keep each field within its stated limit.';
  if (code === 'CONSENT_REQUIRED') return 'Confirm the Career profile consent choice before saving.';
  if (code?.startsWith('CONSENT_')) return 'Career profile consent is unavailable or withdrawn. Review your privacy choices.';
  if (/^(auth\/|AUTH_|INVALID_AUTHORIZATION|ACCOUNT_|TENANT_)/.test(code ?? '')) return 'Your current account cannot access this profile. Sign in again or contact support.';
  return 'The profile could not be loaded or saved. Check your connection, then reload the saved profile.';
}

export function mountProfileEditor(root, bindings) {
  const document = root.ownerDocument;
  const client = createProfileClient(bindings);
  const element = (tag,text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node; };
  const section = element('section'); section.className = 'career-profile'; section.setAttribute('aria-label','Career profile');
  const heading = element('h1','Your Career profile');
  const status = element('p'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  const form = element('form'); const fields = {};
  const definitions = [['displayName','Name',256],['location','Location',256],['skills','Skills (one per line)',null],['links','Links (one per line)',null],['experience','Experience',4096]];
  for (const [name,label,max] of definitions) {
    const wrap = element('label',label), input = element(['skills','links','experience'].includes(name) ? 'textarea' : 'input');
    input.name = name; input.id = 'career-profile-'+name;
    if (max) input.maxLength = max;
    if (name === 'displayName') { input.required = true; input.autocomplete = 'name'; }
    if (name === 'location') input.autocomplete = 'address-level2';
    wrap.append(input); form.append(wrap); fields[name] = input;
  }
  const consentLabel = element('label'); consentLabel.className = 'career-profile-consent';
  const consent = element('input'); consent.type = 'checkbox'; consent.name = 'consent';
  consentLabel.append(consent,document.createTextNode('I agree to store these details for my Career profile using my current Career privacy choice.'));
  const privacy = element('button','Review privacy choices'); privacy.type = 'button'; privacy.name = 'privacy';
  const privacyAvailability = element('p',typeof bindings.reviewPrivacyChoices === 'function' ? '' : 'Privacy choices are unavailable in this environment.');
  const save = element('button','Save profile'); save.type = 'submit';
  const reload = element('button','Reload saved profile'); reload.type = 'button'; reload.name = 'reload';
  const warning = element('p','Resume uploads are not available yet. This editor saves profile details only.');
  form.append(consentLabel,privacy,privacyAvailability,save,reload); section.append(heading,status,form,warning); root.replaceChildren(section);
  let lastUid, lastDraft, state;
  const unsubscribe = client.subscribe(next => {
    state = next; section.setAttribute('aria-busy',String(['loading','saving'].includes(next.phase)));
    status.textContent = messages[next.phase] ?? errorMessage(next.code);
    if (next.uid !== lastUid || ['signed-out','denied','idle'].includes(next.phase)) consent.checked = false;
    lastUid = next.uid;
    const draftKey = JSON.stringify(next.draft);
    if (draftKey !== lastDraft) {
      for (const [name,input] of Object.entries(fields)) {
        const value = Array.isArray(next.draft[name]) ? next.draft[name].join('\n') : next.draft[name];
        if (input.value !== value) input.value = value;
      }
      lastDraft = draftKey;
    }
    const blocked = ['loading','saving','signed-out','denied'].includes(next.phase);
    for (const input of [...Object.values(fields),consent]) input.disabled = blocked;
    save.disabled = blocked || ['conflict','saved-unverified','save-uncertain','timed-out','idle'].includes(next.phase);
    reload.disabled = ['loading','saving','signed-out'].includes(next.phase);
    privacy.disabled = typeof bindings.reviewPrivacyChoices !== 'function' || !next.uid || ['loading','saving'].includes(next.phase);
  });
  const collect = () => Object.fromEntries(Object.entries(fields).map(([name,input]) => [name,['skills','links'].includes(name) ? input.value.split('\n').map(x=>x.trim()).filter(Boolean) : input.value]));
  form.addEventListener('input',() => client.update(collect()));
  form.addEventListener('submit',event => { event.preventDefault(); client.update(collect()); void client.save(consent.checked); });
  reload.addEventListener('click',() => {
    if (state.dirty && !document.defaultView.confirm('Reloading discards your unsaved profile edits. Continue?')) return;
    void client.load();
  });
  privacy.addEventListener('click',async() => {
    const uid = client.snapshot().uid;
    if (!uid || typeof bindings.reviewPrivacyChoices !== 'function') return;
    try { await bindings.reviewPrivacyChoices({uid,purpose:'career.profile'}); }
    catch { if (client.snapshot().uid === uid) privacyAvailability.textContent = 'Privacy choices could not be opened. Try again or contact support.'; }
  });
  // The host route can wait for its Auth-ready callback before mounting. An Auth
  // change deliberately clears the view and requires a new account-scoped load.
  if (client.snapshot().uid) void client.load();
  return {client,dispose() { unsubscribe(); client.dispose(); root.replaceChildren(); }};
}
