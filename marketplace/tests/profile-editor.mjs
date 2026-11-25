import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {mountCareerRoute} from '../app/index.mjs';

// Minimal owned DOM interface exercises the real mounted editor. This is a
// source-level interaction test, not a browser renderer or screen-reader proof.
class FixtureNode extends EventTarget {
  constructor(tag,document) { super(); this.tagName=tag;this.ownerDocument=document;this.children=[];this.attributes={};this.value='';this.checked=false;this.disabled=false;this.textContent=''; }
  append(...children) { for(const child of children){this.children.push(child);child.parentNode=this;} }
  replaceChildren(...children) { this.children=[];this.append(...children); }
  setAttribute(name,value) { this.attributes[name]=value; }
  descendants() { return this.children.flatMap(child=>[child,...child.descendants()]); }
}
function fixtureDocument() {
  const document={defaultView:{confirm:()=>true}};
  document.createElement=tag=>new FixtureNode(tag,document);
  document.createTextNode=text=>{const node=new FixtureNode('#text',document);node.textContent=text;return node;};
  return document;
}
const settle = async (editor,phase) => {
  for(let i=0;i<300;i++){if(editor.client.snapshot().phase===phase)return;await new Promise(r=>setTimeout(r,5));}
  assert.fail('editor did not reach '+phase+': '+JSON.stringify(editor.client.snapshot()));
};
export async function runProfileEditorScenarios({check,base,origin,pc,db,C}) {
  async function mount(overrides={}) {
    const document=fixtureDocument(),root=document.createElement('main');let currentUser={uid:'candidate',getIdToken:async()=> 'candidate'};let callback;
    const bindings={session:{currentUser:()=>currentUser,subscribe:listener=>{callback=listener;listener(currentUser);return()=>{callback=null;};}},consentAuthority:async()=>pc,
      fetch:(path,options)=>fetch(base+path,{...options,headers:{...options.headers,Origin:origin}}),...overrides};
    const editor=await mountCareerRoute(root,bindings,{pathname:'/candidate/profile'});
    const node=(tag,name)=>root.descendants().find(x=>x.tagName===tag&&(!name||x.name===name));
    return {document,root,editor,node,setUser(next){currentUser=next;callback?.(next);}};
  }
  const gate=()=>{let release;const promise=new Promise(r=>release=r);return{promise,release};};
  const turns=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
  await check('Career profile recovery editor bounds hung SDK load and enables truthful manual saved reload',async()=>{
    const waiting=gate(),arrived=gate(),user={uid:'candidate',getIdToken:async()=>{arrived.release();await waiting.promise;return'candidate';}};let f;
    try{mock.timers.enable({apis:['setTimeout']});f=await mount({session:{currentUser:()=>user,subscribe:listener=>{listener(user);return()=>{};}}});await arrived.promise;mock.timers.tick(20000);await turns();
      assert.equal(f.editor.client.snapshot().phase,'timed-out');const status=f.root.descendants().find(x=>x.attributes.role==='status'),save=f.root.descendants().find(x=>x.tagName==='button'&&x.type==='submit');
      assert.equal(status.textContent,'This request took too long. Reload the saved profile to check its current state.');assert.equal(save.disabled,true);assert.equal(f.node('button','reload').disabled,false);
      mock.timers.reset();waiting.release();user.getIdToken=async()=> 'candidate';f.node('button','reload').dispatchEvent(new Event('click'));await settle(f.editor,'ready');assert.equal(f.node('input','displayName').value,db.data(C.profiles+'/candidate').displayName);
    }finally{mock.timers.reset();f?.editor.dispose();waiting.release();}
  });
  await check('Career profile recovery editor unknown attempted write blocks retry and reloads actual stored bytes',async()=>{
    const waiting=gate(),arrived=gate();let hold=false,posts=0,f;
    try{f=await mount({fetch:async(path,options)=>{const response=await fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});if(options.method==='POST'){posts++;if(hold){arrived.release();await waiting.promise;}}return response;}});await settle(f.editor,'ready');
      const name=f.node('input','displayName'),form=f.node('form'),save=f.root.descendants().find(x=>x.tagName==='button'&&x.type==='submit');name.value='Actual editor uncertain stored name';form.dispatchEvent(new Event('input'));f.node('input','consent').checked=true;hold=true;
      mock.timers.enable({apis:['setTimeout']});form.dispatchEvent(new Event('submit',{cancelable:true}));await arrived.promise;mock.timers.tick(20000);await turns();assert.equal(f.editor.client.snapshot().phase,'save-uncertain');assert.equal(db.data(C.profiles+'/candidate').displayName,name.value);
      assert.equal(save.disabled,true);assert.equal(f.node('button','reload').disabled,false);assert.equal(f.root.descendants().find(x=>x.attributes.role==='status').textContent,'The save result could not be confirmed. Reload the saved profile before saving again.');
      form.dispatchEvent(new Event('submit',{cancelable:true}));await turns();assert.equal(posts,1);mock.timers.reset();waiting.release();hold=false;f.node('button','reload').dispatchEvent(new Event('click'));await settle(f.editor,'ready');assert.equal(f.editor.client.snapshot().revision,2);assert.equal(name.value,'Actual editor uncertain stored name');
    }finally{mock.timers.reset();f?.editor.dispose();waiting.release();}
  });
  await check('Career profile recovery editor numeric abort after persisted POST stays stable and blocks blind retry',async()=>{
    let fail=false,posts=0,f;
    try{f=await mount({fetch:async(path,options)=>{const response=await fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});if(options.method==='POST'){posts++;if(fail)throw new DOMException('Owned aborted transport','AbortError');}return response;}});await settle(f.editor,'ready');
      const name=f.node('input','displayName'),form=f.node('form'),save=f.root.descendants().find(x=>x.tagName==='button'&&x.type==='submit');name.value='Actual numeric abort stored name';form.dispatchEvent(new Event('input'));f.node('input','consent').checked=true;fail=true;
      form.dispatchEvent(new Event('submit',{cancelable:true}));await settle(f.editor,'save-uncertain');assert.equal(db.data(C.profiles+'/candidate').revision,2);assert.equal(save.disabled,true);assert.equal(f.editor.client.snapshot().code,'PROFILE_CONNECTION_FAILED');
      assert.equal(f.root.descendants().find(x=>x.attributes.role==='status').textContent,'The save result could not be confirmed. Reload the saved profile before saving again.');form.dispatchEvent(new Event('submit',{cancelable:true}));await turns();assert.equal(posts,1);
      fail=false;f.node('button','reload').dispatchEvent(new Event('click'));await settle(f.editor,'ready');assert.equal(f.editor.client.snapshot().revision,2);assert.equal(name.value,'Actual numeric abort stored name');
    }finally{f?.editor.dispose();}
  });
  await check('Career editor mounted isolated route has labeled fields/status and real persistence/readback',async()=>{
    const f=await mount();await settle(f.editor,'ready');const form=f.node('form'),name=f.node('input','displayName'),consent=f.node('input','consent');
    assert.equal(name.parentNode.tagName,'label');assert.equal(name.parentNode.textContent,'Name');assert.equal(name.maxLength,256);
    const status=f.root.descendants().find(x=>x.attributes.role==='status');assert.equal(status.attributes['aria-live'],'polite');
    name.value='<img src=x onerror=alert(1)> Synthetic';form.dispatchEvent(new Event('input'));consent.checked=true;
    const event=new Event('submit',{cancelable:true});form.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
    assert.equal(f.editor.client.snapshot().phase,'saving');assert.equal(name.disabled,true);await settle(f.editor,'saved');
    assert.equal(status.textContent,'Profile saved and checked.');assert.equal(db.data(C.profiles+'/candidate').displayName,name.value);
    assert(!f.root.descendants().some(x=>x.tagName==='img'));assert.equal(f.node('a'),undefined);assert.equal(f.node('button','privacy').disabled,true);f.editor.dispose();assert.equal(f.root.children.length,0);
  });
  await check('Career editor prevents unsaved-draft discard without explicit confirmation',async()=>{
    const f=await mount();await settle(f.editor,'ready');const name=f.node('input','displayName');name.value='Unsaved fixture';f.node('form').dispatchEvent(new Event('input'));
    const reload=f.node('button','reload');f.document.defaultView.confirm=()=>false;reload.dispatchEvent(new Event('click'));
    assert.equal(f.editor.client.snapshot().draft.displayName,'Unsaved fixture');f.document.defaultView.confirm=()=>true;reload.dispatchEvent(new Event('click'));await settle(f.editor,'ready');
    assert.equal(name.value,db.data(C.profiles+'/candidate').displayName);f.editor.dispose();
  });
  await check('Career editor account change removes previous fields and consent before another load',async()=>{
    const f=await mount();await settle(f.editor,'ready');f.node('input','consent').checked=true;
    f.setUser({uid:'candidate2',getIdToken:async()=> 'candidate2'});assert.equal(f.node('input','displayName').value,'');assert.equal(f.node('input','consent').checked,false);
    assert.equal(f.root.descendants().find(x=>x.tagName==='button'&&x.type==='submit').disabled,true);
    f.node('button','reload').dispatchEvent(new Event('click'));await settle(f.editor,'ready');assert.equal(f.node('input','displayName').value,'Synthetic candidate2');
    f.setUser(null);assert.equal(f.node('input','displayName').disabled,true);assert.equal(f.node('input','displayName').value,'');f.editor.dispose();
  });
  await check('Career editor safe error text plus retry; inactive operator routes never mounted',async()=>{
    let fail=true;const f=await mount({fetch:(path,options)=>{if(fail)throw Error('private fixture detail');return fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});}});
    await settle(f.editor,'error');const status=f.root.descendants().find(x=>x.attributes.role==='status');assert(!status.textContent.includes('private fixture detail'));
    fail=false;f.node('button','reload').dispatchEvent(new Event('click'));await settle(f.editor,'ready');f.editor.dispose();
    assert.equal(await mountCareerRoute(f.root,{}, {pathname:'/marketplace/profile'}),null);assert.equal(f.root.children.length,0);
  });
  await check('Career editor opens only explicit host privacy callback; absent binding never invents settings route',async()=>{
    const calls=[];const f=await mount({reviewPrivacyChoices:async context=>{calls.push(context);}});await settle(f.editor,'ready');
    assert.equal(f.node('button','privacy').disabled,false);f.node('button','privacy').dispatchEvent(new Event('click'));assert.deepEqual(calls,[{uid:'candidate',purpose:'career.profile'}]);
    f.setUser(null);assert.equal(f.node('button','privacy').disabled,true);f.editor.dispose();
    const missing=await mount();await settle(missing.editor,'ready');assert.equal(missing.node('button','privacy').disabled,true);
    assert(missing.root.descendants().some(x=>x.textContent==='Privacy choices are unavailable in this environment.'));assert.equal(missing.node('a'),undefined);missing.editor.dispose();
  });
}
