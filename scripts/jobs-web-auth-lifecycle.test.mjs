import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('../web/node_modules/typescript');
const root = path.resolve(new URL('..', import.meta.url).pathname);
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Execute the authored components and current-auth helper consumed by Vite.
// Only React's scheduling and Firebase's notification/token boundary are local
// adapters; no browser, deployed Auth, credentials or backend acceptance is claimed.
function mount(component) {
  const values = [], effects = [], setters = [], cache = new Map();
  let cursor = 0, listener, stopped = false, writes = 0;
  const jsx = (type, props) => ({ type, props });
  const auth = { currentUser: null };
  const login = deferred();
  const firebase = {
    onAuthStateChanged(_auth, next) { listener = next; return () => { stopped = true; }; },
    signInWithEmailAndPassword: () => login.promise,
    signOut: async () => { auth.currentUser = null; listener(null); },
  };
  const react = {
    Component: class {},
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = initial;
      const set = value => { writes++; values[index] = typeof value === 'function' ? value(values[index]) : value; };
      setters[index] = set;
      return [values[index], set];
    },
    useEffect(effect) { if (!stopped && effects.length === 0) effects.push(effect); },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const source = fs.readFileSync(file, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    const module = { exports: {} };
    vm.runInNewContext(output, {
      module, exports: module.exports, console, Promise,
      window: { location: { pathname: '/admin' } },
      require(name) {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
        if (name === 'firebase/auth') return firebase;
        if (name.endsWith('/firebase')) return { auth };
        if (name.endsWith('/analytics')) return { trackJobsEvent() {} };
        if (name.startsWith('.') && /\/(authz|currentAuth)$/.test(name)) {
          return load(path.resolve(path.dirname(file), name + '.ts'));
        }
        if (name.includes('/pages/')) return new Proxy({}, { get: (_target, key) => () => jsx(String(key), {}) });
        throw new Error('Unexpected source dependency: ' + name);
      },
    }, { filename: file });
    cache.set(file, module.exports);
    return module.exports;
  }
  const file = path.join(root, component === 'App' ? 'web/src/App' : 'web/src/pages/LoginPage') +
    '.tsx';
  const exports = load(file);
  const render = () => { cursor = 0; return (component === 'App' ? exports.default : exports.LoginPage)(); };
  const tree = render();
  const cleanup = effects[0]();
  const userIndex = component === 'App' ? 0 : 2, claimsIndex = component === 'App' ? 1 : 3;
  return {
    tree, render, login, values,
    emit(user) { auth.currentUser = user; return listener(user); },
    cleanup, get stopped() { return stopped; }, get writes() { return writes; },
    state: () => ({ user: values[userIndex], claims: values[claimsIndex], loading: component === 'App' ? values[2] : undefined }),
  };
}

function syntheticUser(uid, token = deferred()) {
  return { user: { uid, email: uid + '@fixture.invalid', getIdTokenResult: () => token.promise }, token };
}

  for (const component of ['App', 'LoginPage']) {
    test(`${component}: sign-out fences a delayed operator token`, async () => {
      const f = mount(component), old = syntheticUser('old-operator');
      const pending = f.emit(old.user);
      await Promise.resolve(f.emit(null));
      old.token.resolve({ claims: { role: 'operator' } });
      await Promise.resolve(pending); await flush();
      assert.equal(f.state().user, null);
      assert.equal(f.state().claims, null);
      if (component === 'App') assert.equal(f.state().loading, false);
      f.cleanup();
    });

    test(`${component}: account switch clears and fences previous operator claims`, async () => {
      const f = mount(component), old = syntheticUser('old-operator'), current = syntheticUser('current-member');
      old.token.resolve({ claims: { role: 'operator' } });
      await Promise.resolve(f.emit(old.user)); await flush();
      assert.equal(f.state().claims.role, 'operator');
      const pending = f.emit(current.user);
      assert.equal(f.state().claims, null);
      if (component === 'App') assert.equal(f.state().loading, true);
      current.token.resolve({ claims: { role: 'member' } });
      await Promise.resolve(pending); await flush();
      assert.equal(f.state().user.uid, 'current-member');
      assert.equal(f.state().claims.role, 'member');
      f.cleanup();
    });

    test(`${component}: reversed token completion preserves the current account`, async () => {
      const f = mount(component), old = syntheticUser('old-operator'), current = syntheticUser('current-member');
      const oldPending = f.emit(old.user), currentPending = f.emit(current.user);
      current.token.resolve({ claims: { role: 'member' } });
      await Promise.resolve(currentPending); await flush();
      old.token.resolve({ claims: { role: 'operator' } });
      await Promise.resolve(oldPending); await flush();
      assert.equal(f.state().user.uid, 'current-member');
      assert.equal(f.state().claims.role, 'member');
      f.cleanup();
    });

    test(`${component}: token failure settles with no role or rejected observer`, async () => {
      const f = mount(component), current = syntheticUser('current-member');
      const pending = Promise.resolve(f.emit(current.user));
      current.token.reject(new Error('synthetic refresh failure'));
      await assert.doesNotReject(pending); await flush();
      assert.equal(f.state().claims, null);
      if (component === 'App') assert.equal(f.state().loading, false);
      f.cleanup();
    });

    test(`${component}: unmount fences pending token state writes`, async () => {
      const f = mount(component), current = syntheticUser('operator');
      const pending = f.emit(current.user);
      f.cleanup(); const writes = f.writes;
      current.token.resolve({ claims: { role: 'operator' } });
      await Promise.resolve(pending); await flush();
      assert.equal(f.stopped, true);
      assert.equal(f.writes, writes);
    });

    test(`${component}: a current operator token settles successfully`, async () => {
      const f = mount(component), current = syntheticUser('current-operator');
      const pending = f.emit(current.user);
      current.token.resolve({ claims: { role: 'operator' } });
      await Promise.resolve(pending); await flush();
      assert.equal(f.state().user.uid, 'current-operator');
      assert.equal(f.state().claims.role, 'operator');
      if (component === 'App') assert.equal(f.state().loading, false);
      f.cleanup();
    });

    test(`${component}: unmount ignores an already queued auth notification`, async () => {
      const f = mount(component), current = syntheticUser('queued-operator');
      f.cleanup(); const writes = f.writes;
      current.token.resolve({ claims: { role: 'operator' } });
      await Promise.resolve(f.emit(current.user)); await flush();
      assert.equal(f.writes, writes);
    });
  }

  test(`LoginPage: sign-in completion cannot independently restore stale claims`, async () => {
    const f = mount('LoginPage'), old = syntheticUser('old-operator');
    function find(node, type) {
      if (!node || typeof node !== 'object') return undefined;
      if (node.type === type) return node;
      for (const child of [node.props?.children].flat()) { const result = find(child, type); if (result) return result; }
    }
    const formNode = find(f.tree, 'form');
    const loginPending = formNode.props.onSubmit({ preventDefault() {} });
    f.login.resolve({ user: old.user }); await flush();
    await Promise.resolve(f.emit(null));
    old.token.resolve({ claims: { role: 'operator' } });
    await loginPending; await flush();
    assert.equal(f.state().claims, null);
    f.cleanup();
  });
