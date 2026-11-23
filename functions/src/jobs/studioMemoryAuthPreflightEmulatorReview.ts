/**
 * R1720: LOCAL AUTH+FIRESTORE PREFLIGHT ONLY.
 * NOT a production issuer, render consent, portable Studio authority, or API.
 * The Privacy life-movie.render purpose is NOT registered. Even successful
 * identity/membership verification can NEVER issue or deliver private media.
 * All Firebase inputs come from the exact test-only emulator project.
 */
import {createHash} from 'node:crypto';
import {getApps} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';

const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
type Result={status:'unavailable'}|{status:'membership_verified_render_unapproved'};
const deny=():Result=>({status:'unavailable'});
function localOnly(){
 return process.env.GCLOUD_PROJECT==='demo-urai-r1720'
  &&process.env.FIRESTORE_EMULATOR_HOST==='127.0.0.1:28791'
  &&process.env.FIREBASE_AUTH_EMULATOR_HOST==='127.0.0.1:28792'
  &&process.env.URAI_PRIVATE_MEMORY_WRITES_ENABLED==='false'
  &&process.env.GOOGLE_APPLICATION_CREDENTIALS===undefined;
}
export async function inspectDemoStudioIdentityWithoutGrant(
 token:unknown,expectedTenant:unknown
):Promise<Result>{
 if(!localOnly()||typeof token!=='string'||token.length<20||token.length>8192
  ||typeof expectedTenant!=='string'||!ID.test(expectedTenant))return deny();
 const app=getApps().find(a=>a.name==='r1720-native'
  &&a.options.projectId==='demo-urai-r1720');
 if(!app)return deny();
 try{
  const auth=getAuth(app),db=getFirestore(app);
  const original=await auth.verifyIdToken(token,true);
  const tenant=typeof original.tenantId==='string'?original.tenantId:original.studioId;
  if(!ID.test(original.uid)||tenant!==expectedTenant)return deny();
  const uid=original.uid;
  const fenceId=createHash('sha256').update('urai-studio-data-rights:'+uid).digest('hex');
  const paths=[
   'studioUsers/'+uid,
   'memberships/'+uid+'_'+tenant,
   'studioDataRightsOwnerFences/'+fenceId,
   'privacyDeletionTombstones/'+uid
  ];
  const first=await Promise.all(paths.map(p=>db.doc(p).get()));
  const [user,member,fence,tomb]=first;
  if(!user.exists||!member.exists||fence.exists||tomb.exists)return deny();
  const u=user.data(),m=member.data();
  if(!u||u.uid!==uid||u.revoked===true||u.disabled===true
   ||!['owner','admin'].includes(String(u.role))
   ||!m||m.uid!==uid||m.studioId!==tenant
   ||!['owner','creator'].includes(String(m.role))
   ||m.active!==true||m.disabled===true||m.revoked===true)return deny();
  const second=await Promise.all(paths.map(p=>db.doc(p).get()));
  for(let i=0;i<first.length;i++){
   if(first[i].exists!==second[i].exists
    ||JSON.stringify(first[i].data())!==JSON.stringify(second[i].data()))return deny();
  }
  const fresh=await auth.verifyIdToken(token,true);
  const freshTenant=typeof fresh.tenantId==='string'?fresh.tenantId:fresh.studioId;
  if(fresh.uid!==uid||freshTenant!==tenant)return deny();
  // No affirmative Privacy issuer exists. NEVER return a render grant here.
  return {status:'membership_verified_render_unapproved'};
 }catch{return deny();}
}
