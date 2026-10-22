import test from 'node:test';
import assert from 'node:assert/strict';
import {assertChalkBridgeLeaseUnchanged} from '../functions/src/jobs/chalkCrossProjectAuthority.ts';
const a=()=>({jobsUid:'jobs_founder_123',spatialUid:'spatial_founder_123',action:'engineering:read',bindingRevision:4,expiresAtMs:500000,tenantId:null,orgId:null});
test('identical valid approval continues',()=>assert.doesNotThrow(()=>assertChalkBridgeLeaseUnchanged(a(),a(),100000)));
for(const [field,value] of [['jobsUid','other_jobs_user'],['spatialUid','other_spatial_user'],['action','engineering:intake'],['bindingRevision',5],['expiresAtMs',550000],['tenantId','other-tenant'],['orgId','other-org']])test('reject changed '+field,()=>{const current=a();assert.throws(()=>assertChalkBridgeLeaseUnchanged(current,{...current,[field]:value},100000),/LEASE_CHANGED/)});
test('reject expiry during work',()=>assert.throws(()=>assertChalkBridgeLeaseUnchanged(a(),a(),500000),/LEASE_EXPIRED/));
test('reject invalid clock',()=>assert.throws(()=>assertChalkBridgeLeaseUnchanged(a(),a(),NaN),/LEASE_INVALID/));
