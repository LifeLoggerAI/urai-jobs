import {createApplicationsClient} from './applications-client.mjs';

const labels={submitted:'Submitted',reviewing:'Under review',withdrawn:'Withdrawn',rejected:'Rejected',advanced:'Advanced',unknown:'Status unavailable'};
const busy=phase=>['loading','loading-more','withdrawing'].includes(phase);
const messages={idle:'Load your applications to begin.',loading:'Loading your application status…','loading-more':'Loading the next page of your applications…',empty:'You have no applications to show.',ready:'Loaded application status has been checked.',
  withdrawing:'Withdrawing and checking the saved result…',withdrawn:'Application withdrawn and checked.',
  'signed-out':'Sign in to view your applications.',conflict:'This application changed before withdrawal. Reload its current status.',
  'withdrawal-unverified':'Withdrawal was acknowledged, but its saved status could not be checked. Reload before taking another action.',
  'withdrawal-uncertain':'The withdrawal result could not be confirmed. Reload to check its actual status before trying again.',
  interrupted:'Stopped waiting for this request. Reload to check the actual saved status.',
  'timed-out':'This request took too long. Reload to check its actual saved status.'};
function errorMessage(code) {
  if(code==='MARKETPLACE_LAUNCH_BLOCKED')return'Applications are not available in this environment yet.';
  if(code?.startsWith('CONSENT_'))return'Your current privacy choice does not allow these application details to be shown.';
  if(/^(auth\/|AUTH_|INVALID_AUTHORIZATION|ACCOUNT_|TENANT_|APPLICATION_OWNER_REQUIRED)/.test(code??''))return'Your current account cannot access these applications. Sign in again or contact support.';
  return'Applications could not be checked. Reload after checking your connection.';
}
export function mountApplicationsView(root,bindings) {
  const document=root.ownerDocument,client=createApplicationsClient(bindings);
  const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  const section=element('section');section.className='career-applications';section.setAttribute('aria-label','Your Career applications');
  const heading=element('h1','Your applications'),status=element('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const reload=element('button','Reload application status');reload.type='button';reload.name='reload';
  const interrupt=element('button','Stop waiting');interrupt.type='button';interrupt.name='interrupt';
  const more=element('button','Load more applications');more.type='button';more.name='more';
  const list=element('ul');list.setAttribute('aria-label','Application status');
  const capacity=element('p');
  const notice=element('p','Withdrawal stops this application and retains its history. It does not recall copies already delivered outside UrAi.');
  section.append(heading,status,reload,interrupt,capacity,list,more,notice);root.replaceChildren(section);
  let lastItems,lastUid,disposed=false,state,viewOperation=0,lastActor=bindings.session.currentUser();
  const unsubscribe=client.subscribe(state=>{
    const actor=bindings.session.currentUser();
    if(actor!==lastActor||busy(state.phase))viewOperation++;
    lastActor=actor;
    // Local state is used for explicit action guards; aria-disabled retains
    // keyboard focus while a request is busy or its cached status is stale.
    latest(state);
    section.setAttribute('aria-busy',String(busy(state.phase)));
    status.textContent=messages[state.phase]??errorMessage(state.code);
    capacity.textContent=state.nextCursor?'Showing '+state.items.length+' loaded applications. More applications are available.':state.items.length?'Showing '+state.items.length+' loaded applications. No further page was returned.':'';
    reload.setAttribute('aria-disabled',String(busy(state.phase)||state.phase==='signed-out'));
    interrupt.setAttribute('aria-disabled',String(!busy(state.phase)));
    more.setAttribute('aria-disabled',String(state.stale||!state.nextCursor||!['ready','withdrawn'].includes(state.phase)));
    const key=JSON.stringify(state.items);
    if(key!==lastItems||state.uid!==lastUid){
      list.replaceChildren();
      for(const item of state.items){
        const row=element('li'),title=element('h2',item.title??'Job details unavailable');
        if(item.title)row.append(element('p','Job title at last refresh'));
        row.append(title,element('p','Job reference: '+item.jobId),element('p',labels[item.status]));
        const withdraw=element('button',item.status==='withdrawn'?'Withdrawn':'Withdraw application');withdraw.type='button';withdraw.name=item.id;
        withdraw.setAttribute('aria-disabled',String(!['submitted','reviewing'].includes(item.status)));
        withdraw.addEventListener('click',async()=>{
          const current=client.snapshot();
          if(current.stale||!['ready','withdrawn'].includes(current.phase)||!['submitted','reviewing'].includes(current.items.find(x=>x.id===item.id)?.status))return;
          const actor=bindings.session.currentUser(),wasFocused=document.activeElement===withdraw;
          if(!document.defaultView.confirm('Withdraw this application? It will remain in your application history.'))return;
          const pending=client.withdraw(item.id),operation=viewOperation;
          const result=await pending;
          const focusLost=document.activeElement==null||document.activeElement===document.body;
          if(!disposed&&wasFocused&&result?.verified&&result.isCurrent()&&viewOperation===operation
            &&bindings.session.currentUser()===actor&&!root.contains(withdraw)&&focusLost&&root.isConnected!==false)reload.focus?.();
        });
        row.append(withdraw);list.append(row);
      }
      lastItems=key;lastUid=state.uid;
    }
    for(const row of list.children){const button=[...row.children].find(x=>x.tagName.toLowerCase()==='button');if(button){const item=state.items.find(x=>x.id===button.name);button.setAttribute('aria-disabled',String(state.stale||!['ready','withdrawn'].includes(state.phase)||!['submitted','reviewing'].includes(item?.status)));}}
  });
  function latest(next){state=next;}
  reload.addEventListener('click',()=>{if(!busy(state.phase)&&state.phase!=='signed-out')void client.load();});
  more.addEventListener('click',()=>{if(!state.stale&&state.nextCursor&&['ready','withdrawn'].includes(state.phase))void client.loadMore();});
  interrupt.addEventListener('click',()=>{if(busy(state.phase))client.interrupt();});
  if(client.snapshot().uid)void client.load();
  return{client,dispose(){disposed=true;unsubscribe();client.dispose();root.replaceChildren();}};
}
