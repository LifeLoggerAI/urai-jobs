import assert from 'node:assert/strict';
import {mountCareerRoute} from '../app/index.mjs';

// Source interactions over the real compiled HTTP API using the existing owned
// fixture interfaces. Minimal DOM does not establish rendered browser acceptance.
class FixtureNode extends EventTarget {
  constructor(tag,document){super();this.tagName=tag;this.ownerDocument=document;this.children=[];this.attributes={};this.textContent='';this.disabled=false;}
  append(...children){for(const child of children){this.children.push(child);child.parentNode=this;}}
  replaceChildren(...children){if(this.contains(this.ownerDocument.activeElement))this.ownerDocument.activeElement=this.ownerDocument.body;for(const child of this.children)child.parentNode=null;this.children=[];this.append(...children);}
  setAttribute(name,value){this.attributes[name]=value;}
  descendants(){return this.children.flatMap(x=>[x,...x.descendants()]);}
  contains(node){return this===node||this.descendants().includes(node);}
  get isConnected(){return this===this.ownerDocument.body||Boolean(this.parentNode?.isConnected);}
  focus(){this.ownerDocument.activeElement=this;}
}
const settle=async(view,phase)=>{for(let i=0;i<300;i++){if(view.client.snapshot().phase===phase)return;await new Promise(r=>setTimeout(r,5));}assert.fail('applications view did not reach '+phase+': '+JSON.stringify(view.client.snapshot()));};
export async function runApplicationsViewScenarios({check,base,origin,createApp,db,C,aid,change}) {
  async function mount(overrides={}) {
    const document={defaultView:{confirm:()=>true},activeElement:null};document.createElement=tag=>new FixtureNode(tag,document);document.body=document.createElement('body');document.activeElement=document.body;const root=document.createElement('main');document.body.append(root);let currentUser={uid:'candidate',getIdToken:async()=> 'candidate'},callback;
    const view=await mountCareerRoute(root,{session:{currentUser:()=>currentUser,subscribe:listener=>{callback=listener;listener(currentUser);return()=>{callback=null;};}},fetch:(path,options)=>fetch(base+path,{...options,headers:{...options.headers,Origin:origin}}),...overrides},{pathname:'/candidate/applications'});
    assert(view,'existing isolated /candidate/applications route must mount');
    return{root,document,view,node:(tag,name)=>root.descendants().find(x=>x.tagName===tag&&(!name||x.name===name)),setUser(next){currentUser=next;callback?.(next);}};
  }
  await check('Career applications view mounted isolated route shows source status/title and persists confirmed withdrawal',async()=>{
    await createApp();const f=await mount();await settle(f.view,'ready');const status=f.root.descendants().find(x=>x.attributes.role==='status');assert.equal(status.attributes['aria-live'],'polite');
    assert(f.root.descendants().some(x=>x.textContent==='Synthetic role'));assert(f.root.descendants().some(x=>x.textContent==='Submitted'));const withdraw=f.node('button',aid());assert.equal(withdraw.attributes['aria-disabled'],'false');withdraw.focus();
    withdraw.dispatchEvent(new Event('click'));assert.equal(f.view.client.snapshot().phase,'withdrawing');assert.equal(withdraw.attributes['aria-disabled'],'true');assert.equal(f.document.activeElement,withdraw);await settle(f.view,'withdrawn');
    assert.equal(db.data(C.apps+'/'+aid()).status,'withdrawn');assert.equal(status.textContent,'Application withdrawn and checked.');assert.equal(f.node('button',aid()).attributes['aria-disabled'],'true');assert.equal(f.document.activeElement,f.node('button','reload'));f.view.dispose();assert.equal(f.root.children.length,0);
  });
  await check('Career applications view explicit decline does not dispatch withdrawal',async()=>{
    await createApp();const f=await mount();await settle(f.view,'ready');const writes=db.writes.length;f.document.defaultView.confirm=()=>false;f.node('button',aid()).dispatchEvent(new Event('click'));
    assert.equal(db.writes.length,writes);assert.equal(f.view.client.snapshot().phase,'ready');assert.equal(db.data(C.apps+'/'+aid()).status,'submitted');f.view.dispose();
  });
  await check('Career applications view manual pagination retains focus and allows a last-page persisted stop',async()=>{
    await createApp();const stored=db.data(C.apps+'/'+aid());db.erase(C.apps+'/'+aid());for(let n=0;n<51;n++){const id='candidate:job'+String(n).padStart(3,'0');db.put(C.apps+'/'+id,{...stored,id});}
    const f=await mount();await settle(f.view,'ready');assert.equal(f.view.client.snapshot().items.length,50);const more=f.node('button','more');assert.equal(more.attributes['aria-disabled'],'false');more.focus();more.dispatchEvent(new Event('click'));assert.equal(more.attributes['aria-disabled'],'true');assert.equal(f.document.activeElement,more);
    await settle(f.view,'ready');assert.equal(f.view.client.snapshot().items.length,51);assert.equal(f.document.activeElement,more);assert.equal(more.attributes['aria-disabled'],'true');const count=f.view.client.snapshot().items.length;more.dispatchEvent(new Event('click'));assert.equal(f.view.client.snapshot().items.length,count);
    const last=f.node('button','candidate:job050');last.dispatchEvent(new Event('click'));await settle(f.view,'withdrawn');assert.equal(db.data(C.apps+'/candidate:job050').status,'withdrawn');assert.equal(f.view.client.snapshot().items.length,51);f.view.dispose();
  });
  await check('Career applications view unknown/terminal status disables stop and creates no fabricated job route',async()=>{
    await createApp();change(C.apps+'/'+aid(),{status:'unsupported'});const f=await mount();await settle(f.view,'ready');assert(f.root.descendants().some(x=>x.textContent==='Status unavailable'));assert.equal(f.node('button',aid()).attributes['aria-disabled'],'true');assert.equal(f.node('a'),undefined);f.view.dispose();
  });
  await check('Career applications view safe public title text and explicit missing/closed title recovery',async()=>{
    await createApp();change(C.jobs+'/job',{title:'<img src=x onerror=alert(1)> Synthetic title'});const f=await mount();await settle(f.view,'ready');assert(f.root.descendants().some(x=>x.textContent==='<img src=x onerror=alert(1)> Synthetic title'));assert.equal(f.node('img'),undefined);
    change(C.jobs+'/job',{status:'closed'});f.node('button','reload').dispatchEvent(new Event('click'));await settle(f.view,'ready');assert(f.root.descendants().some(x=>x.textContent==='Job details unavailable'));assert(f.root.descendants().some(x=>x.textContent==='Job reference: job'));assert.equal(f.node('button',aid()).attributes['aria-disabled'],'false');f.view.dispose();
  });
  await check('Career applications view account changes remove old rows; signed-out state disables interaction',async()=>{
    await createApp();const f=await mount();await settle(f.view,'ready');f.setUser({uid:'candidate2',getIdToken:async()=> 'candidate2'});assert.equal(f.node('button',aid()),undefined);assert.equal(f.view.client.snapshot().phase,'idle');
    f.node('button','reload').dispatchEvent(new Event('click'));await settle(f.view,'empty');assert(f.root.descendants().some(x=>x.textContent==='You have no applications to show.'));f.setUser(null);assert.equal(f.node('button','reload').attributes['aria-disabled'],'true');assert.deepEqual(f.view.client.snapshot().items,[]);f.view.dispose();
  });
  await check('Career applications view interrupted waiting and safe error never claim canceled server work',async()=>{
    let fail=true;const f=await mount({fetch:(path,options)=>{if(fail)throw Error('private fixture message');return fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});}});await settle(f.view,'error');const status=f.root.descendants().find(x=>x.attributes.role==='status');assert(!status.textContent.includes('private fixture message'));
    fail=false;f.node('button','reload').dispatchEvent(new Event('click'));await settle(f.view,'empty');assert.equal(f.node('button','interrupt').attributes['aria-disabled'],'true');f.view.dispose();assert.equal(await mountCareerRoute(f.root,{}, {pathname:'/marketplace/applications'}),null);
  });
  await check('Career applications busy reload retains keyboard focus and cannot dispatch duplicate load',async()=>{
    await createApp();let release,arrive;const wait=new Promise(r=>release=r),arrived=new Promise(r=>arrive=r);let delay=false,count=0;
    const f=await mount({fetch:async(path,options)=>{count++;const r=await fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});if(delay&&path.endsWith('/me')){arrive();await wait;}return r;}});await settle(f.view,'ready');
    const reload=f.node('button','reload');reload.focus();delay=true;reload.dispatchEvent(new Event('click'));await arrived;assert.equal(reload.attributes['aria-disabled'],'true');assert.equal(reload.disabled,false);assert.equal(f.document.activeElement,reload);
    const before=count;reload.dispatchEvent(new Event('click'));assert.equal(count,before);release();await settle(f.view,'ready');assert.equal(f.document.activeElement,reload);f.view.dispose();
  });
  await check('Career applications withdrawal completion never steals newly selected outside focus',async()=>{
    await createApp();let release,arrive;const wait=new Promise(r=>release=r),arrived=new Promise(r=>arrive=r);
    const f=await mount({fetch:async(path,options)=>{const r=await fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});if(options.method==='PATCH'){arrive();await wait;}return r;}});await settle(f.view,'ready');
    const withdraw=f.node('button',aid());withdraw.focus();withdraw.dispatchEvent(new Event('click'));await arrived;assert.equal(f.document.activeElement,withdraw);assert.equal(withdraw.attributes['aria-disabled'],'true');assert.equal(withdraw.disabled,false);
    const outside=f.document.createElement('button');f.document.body.append(outside);outside.focus();release();await settle(f.view,'withdrawn');assert.equal(f.document.activeElement,outside);f.view.dispose();
  });
  await check('Career applications late old completion cannot restore focus into same-UID replacement operation',async()=>{
    db.put(C.jobs+'/job2',{...db.data(C.jobs+'/job'),id:'job2',title:'Second synthetic job'});await createApp();await createApp('candidate',{jobId:'job2'});
    let release,arrive;const wait=new Promise(r=>release=r),arrived=new Promise(r=>arrive=r);
    const f=await mount({fetch:async(path,options)=>{const r=await fetch(base+path,{...options,headers:{...options.headers,Origin:origin}});if(options.method==='PATCH'&&path.includes('/'+aid()+'/')){arrive();await wait;}return r;}});await settle(f.view,'ready');
    const old=f.node('button',aid());old.focus();old.dispatchEvent(new Event('click'));await arrived;f.setUser({uid:'candidate',getIdToken:async()=> 'candidate'});assert.equal(f.node('button',aid()),undefined);
    f.node('button','reload').dispatchEvent(new Event('click'));await settle(f.view,'ready');f.document.activeElement=f.document.body;f.node('button',aid('candidate','job2')).dispatchEvent(new Event('click'));await settle(f.view,'withdrawn');
    assert.equal(f.document.activeElement,f.document.body);release();await new Promise(r=>setTimeout(r,5));assert.equal(f.document.activeElement,f.document.body);assert.equal(f.view.client.snapshot().phase,'withdrawn');f.view.dispose();
  });
}
