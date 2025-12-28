(()=>{var e={};e.id=559,e.ids=[559],e.modules={7849:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external")},2934:e=>{"use strict";e.exports=require("next/dist/client/components/action-async-storage.external.js")},5403:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external")},4580:e=>{"use strict";e.exports=require("next/dist/client/components/request-async-storage.external.js")},4749:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external")},5869:e=>{"use strict";e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},6113:e=>{"use strict";e.exports=require("crypto")},9523:e=>{"use strict";e.exports=require("dns")},2361:e=>{"use strict";e.exports=require("events")},7147:e=>{"use strict";e.exports=require("fs")},3685:e=>{"use strict";e.exports=require("http")},5158:e=>{"use strict";e.exports=require("http2")},1808:e=>{"use strict";e.exports=require("net")},2037:e=>{"use strict";e.exports=require("os")},1017:e=>{"use strict";e.exports=require("path")},7282:e=>{"use strict";e.exports=require("process")},2781:e=>{"use strict";e.exports=require("stream")},4404:e=>{"use strict";e.exports=require("tls")},5034:e=>{"use strict";e.exports=require("url")},3837:e=>{"use strict";e.exports=require("util")},9796:e=>{"use strict";e.exports=require("zlib")},1968:(e,t,r)=>{"use strict";r.r(t),r.d(t,{GlobalError:()=>i.a,__next_app__:()=>d,originalPathname:()=>h,pages:()=>c,routeModule:()=>p,tree:()=>u}),r(7431),r(2567),r(7824);var n=r(3282),s=r(5736),o=r(3906),i=r.n(o),a=r(6880),l={};for(let e in a)0>["default","tree","pages","GlobalError","originalPathname","__next_app__","routeModule"].indexOf(e)&&(l[e]=()=>a[e]);r.d(t,l);let u=["",{children:["apply",{children:["[jobId]",{children:["__PAGE__",{},{page:[()=>Promise.resolve().then(r.bind(r,7431)),"/home/user/urai-jobs/apps/web/app/apply/[jobId]/page.tsx"]}]},{}]},{}]},{layout:[()=>Promise.resolve().then(r.bind(r,2567)),"/home/user/urai-jobs/apps/web/app/layout.tsx"],"not-found":[()=>Promise.resolve().then(r.t.bind(r,7824,23)),"next/dist/client/components/not-found-error"]}],c=["/home/user/urai-jobs/apps/web/app/apply/[jobId]/page.tsx"],h="/apply/[jobId]/page",d={require:r,loadChunk:()=>Promise.resolve()},p=new n.AppPageRouteModule({definition:{kind:s.x.APP_PAGE,page:"/apply/[jobId]/page",pathname:"/apply/[jobId]",bundlePath:"",filename:"",appPaths:[]},userland:{loaderTree:u}})},96:(e,t,r)=>{Promise.resolve().then(r.bind(r,9763))},3455:()=>{},2597:(e,t,r)=>{Promise.resolve().then(r.t.bind(r,4424,23)),Promise.resolve().then(r.t.bind(r,7752,23)),Promise.resolve().then(r.t.bind(r,5275,23)),Promise.resolve().then(r.t.bind(r,9842,23)),Promise.resolve().then(r.t.bind(r,1633,23)),Promise.resolve().then(r.t.bind(r,9224,23))},9763:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>Q});var n,s,o=r(3227),i=r(3677),a=r(1043),l=r(990),u=r(3070),c=r(2639);let h=require("undici");var d=r(497);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let p="firebasestorage.googleapis.com",_="storageBucket";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class f extends c.ZR{constructor(e,t,r=0){super(m(e),`Firebase Storage: ${t} (${m(e)})`),this.status_=r,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,f.prototype)}get status(){return this.status_}set status(e){this.status_=e}_codeEquals(e){return m(e)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(e){this.customData.serverResponse=e,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}function m(e){return"storage/"+e}function g(){return new f(n.UNKNOWN,"An unknown error occurred, please check the error payload for server response.")}function b(e){return new f(n.INVALID_ARGUMENT,e)}function R(){return new f(n.APP_DELETED,"The Firebase app was deleted.")}function E(e,t){return new f(n.INVALID_FORMAT,"String does not match format '"+e+"': "+t)}function w(e){throw new f(n.INTERNAL_ERROR,"Internal error: "+e)}!function(e){e.UNKNOWN="unknown",e.OBJECT_NOT_FOUND="object-not-found",e.BUCKET_NOT_FOUND="bucket-not-found",e.PROJECT_NOT_FOUND="project-not-found",e.QUOTA_EXCEEDED="quota-exceeded",e.UNAUTHENTICATED="unauthenticated",e.UNAUTHORIZED="unauthorized",e.UNAUTHORIZED_APP="unauthorized-app",e.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",e.INVALID_CHECKSUM="invalid-checksum",e.CANCELED="canceled",e.INVALID_EVENT_NAME="invalid-event-name",e.INVALID_URL="invalid-url",e.INVALID_DEFAULT_BUCKET="invalid-default-bucket",e.NO_DEFAULT_BUCKET="no-default-bucket",e.CANNOT_SLICE_BLOB="cannot-slice-blob",e.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",e.NO_DOWNLOAD_URL="no-download-url",e.INVALID_ARGUMENT="invalid-argument",e.INVALID_ARGUMENT_COUNT="invalid-argument-count",e.APP_DELETED="app-deleted",e.INVALID_ROOT_OPERATION="invalid-root-operation",e.INVALID_FORMAT="invalid-format",e.INTERNAL_ERROR="internal-error",e.UNSUPPORTED_ENVIRONMENT="unsupported-environment"}(n||(n={}));/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class v{constructor(e,t){this.bucket=e,this.path_=t}get path(){return this.path_}get isRoot(){return 0===this.path.length}fullServerUrl(){let e=encodeURIComponent;return"/b/"+e(this.bucket)+"/o/"+e(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(e,t){let r;try{r=v.makeFromUrl(e,t)}catch(t){return new v(e,"")}if(""===r.path)return r;throw new f(n.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+e+"'.")}static makeFromUrl(e,t){let r=null,s="([A-Za-z0-9.\\-_]+)",o=RegExp("^gs://"+s+"(/(.*))?$","i");function i(e){e.path_=decodeURIComponent(e.path)}let a=t.replace(/[.]/g,"\\."),l=[{regex:o,indices:{bucket:1,path:3},postModify:function(e){"/"===e.path.charAt(e.path.length-1)&&(e.path_=e.path_.slice(0,-1))}},{regex:RegExp(`^https?://${a}/v[A-Za-z0-9_]+/b/${s}/o(/([^?#]*).*)?$`,"i"),indices:{bucket:1,path:3},postModify:i},{regex:RegExp(`^https?://${t===p?"(?:storage.googleapis.com|storage.cloud.google.com)":t}/${s}/([^?#]*)`,"i"),indices:{bucket:1,path:2},postModify:i}];for(let t=0;t<l.length;t++){let n=l[t],s=n.regex.exec(e);if(s){let e=s[n.indices.bucket],t=s[n.indices.path];t||(t=""),r=new v(e,t),n.postModify(r);break}}if(null==r)throw new f(n.INVALID_URL,"Invalid URL '"+e+"'.");return r}}class y{constructor(e){this.promise_=Promise.reject(e)}getPromise(){return this.promise_}cancel(e=!1){}}function T(e){return"string"==typeof e||e instanceof String}function A(e){return x()&&e instanceof Blob}function x(){return"undefined"!=typeof Blob}function I(e,t,r,n){if(n<t)throw b(`Invalid value for '${e}'. Expected ${t} or greater.`);if(n>r)throw b(`Invalid value for '${e}'. Expected ${r} or less.`)}!function(e){e[e.NO_ERROR=0]="NO_ERROR",e[e.NETWORK_ERROR=1]="NETWORK_ERROR",e[e.ABORT=2]="ABORT"}(s||(s={}));/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class N{constructor(e,t,r,n,s,o,i,a,l,u,c,h=!0){this.url_=e,this.method_=t,this.headers_=r,this.body_=n,this.successCodes_=s,this.additionalRetryCodes_=o,this.callback_=i,this.errorCallback_=a,this.timeout_=l,this.progressCallback_=u,this.connectionFactory_=c,this.retry=h,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((e,t)=>{this.resolve_=e,this.reject_=t,this.start_()})}start_(){let e=(e,t)=>{let r=this.resolve_,s=this.reject_,o=t.connection;if(t.wasSuccessCode)try{let e=this.callback_(o,o.getResponse());void 0!==e?r(e):r()}catch(e){s(e)}else if(null!==o){let e=g();e.serverResponse=o.getErrorText(),s(this.errorCallback_?this.errorCallback_(o,e):e)}else s(t.canceled?this.appDelete_?R():new f(n.CANCELED,"User canceled the upload/download."):new f(n.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again."))};this.canceled_?e(!1,new C(!1,null,!0)):this.backoffId_=/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function(e,t,r){let n=1,s=null,o=null,i=!1,a=0,l=!1;function u(...e){l||(l=!0,t.apply(null,e))}function c(t){s=setTimeout(()=>{s=null,e(d,2===a)},t)}function h(){o&&clearTimeout(o)}function d(e,...t){let r;if(l){h();return}if(e||2===a||i){h(),u.call(null,e,...t);return}n<64&&(n*=2),1===a?(a=2,r=0):r=(n+Math.random())*1e3,c(r)}let p=!1;function _(e){!p&&(p=!0,h(),!l&&(null!==s?(e||(a=2),clearTimeout(s),c(0)):e||(a=1)))}return c(0),o=setTimeout(()=>{i=!0,_(!0)},r),_}((e,t)=>{if(t){e(!1,new C(!1,null,!0));return}let r=this.connectionFactory_();this.pendingConnection_=r;let n=e=>{let t=e.loaded,r=e.lengthComputable?e.total:-1;null!==this.progressCallback_&&this.progressCallback_(t,r)};null!==this.progressCallback_&&r.addUploadProgressListener(n),r.send(this.url_,this.method_,this.body_,this.headers_).then(()=>{null!==this.progressCallback_&&r.removeUploadProgressListener(n),this.pendingConnection_=null;let t=r.getErrorCode()===s.NO_ERROR,o=r.getStatus();if(!t||/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function(e,t){let r=e>=500&&e<600,n=-1!==[408,429].indexOf(e),s=-1!==t.indexOf(e);return r||n||s}(o,this.additionalRetryCodes_)&&this.retry){e(!1,new C(!1,null,r.getErrorCode()===s.ABORT));return}e(!0,new C(-1!==this.successCodes_.indexOf(o),r))})},e,this.timeout_)}getPromise(){return this.promise_}cancel(e){this.canceled_=!0,this.appDelete_=e||!1,null!==this.backoffId_&&(0,this.backoffId_)(!1),null!==this.pendingConnection_&&this.pendingConnection_.abort()}}class C{constructor(e,t,r){this.wasSuccessCode=e,this.connection=t,this.canceled=!!r}}function k(...e){let t="undefined"!=typeof BlobBuilder?BlobBuilder:"undefined"!=typeof WebKitBlobBuilder?WebKitBlobBuilder:void 0;if(void 0!==t){let r=new t;for(let t=0;t<e.length;t++)r.append(e[t]);return r.getBlob()}if(x())return new Blob(e);throw new f(n.UNSUPPORTED_ENVIRONMENT,"This browser doesn't seem to support creating Blobs")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let U={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"};class O{constructor(e,t){this.data=e,this.contentType=t||null}}function P(e){let t=[];for(let r=0;r<e.length;r++){let n=e.charCodeAt(r);n<=127?t.push(n):n<=2047?t.push(192|n>>6,128|63&n):(64512&n)==55296?r<e.length-1&&(64512&e.charCodeAt(r+1))==56320?(n=65536|(1023&n)<<10|1023&e.charCodeAt(++r),t.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n)):t.push(239,191,189):(64512&n)==56320?t.push(239,191,189):t.push(224|n>>12,128|n>>6&63,128|63&n)}return new Uint8Array(t)}function S(e,t){let r;switch(e){case U.BASE64:{let r=-1!==t.indexOf("-"),n=-1!==t.indexOf("_");if(r||n)throw E(e,"Invalid character '"+(r?"-":"_")+"' found: is it base64url encoded?");break}case U.BASE64URL:{let r=-1!==t.indexOf("+"),n=-1!==t.indexOf("/");if(r||n)throw E(e,"Invalid character '"+(r?"+":"/")+"' found: is it base64 encoded?");t=t.replace(/-/g,"+").replace(/_/g,"/")}}try{r=/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function(e){if(/[^-A-Za-z0-9+/=]/.test(e))throw E("base64","Invalid character found");return Buffer.from(e,"base64").toString("binary")}(t)}catch(t){if(t.message.includes("polyfill"))throw t;throw E(e,"Invalid character found")}let n=new Uint8Array(r.length);for(let e=0;e<r.length;e++)n[e]=r.charCodeAt(e);return n}class D{constructor(e){this.base64=!1,this.contentType=null;let t=e.match(/^data:([^,]+)?,/);if(null===t)throw E(U.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");let r=t[1]||null;null!=r&&(this.base64=function(e,t){return e.length>=t.length&&e.substring(e.length-t.length)===t}(r,";base64"),this.contentType=this.base64?r.substring(0,r.length-7):r),this.rest=e.substring(e.indexOf(",")+1)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class L{constructor(e,t){let r=0,n="";A(e)?(this.data_=e,r=e.size,n=e.type):e instanceof ArrayBuffer?(t?this.data_=new Uint8Array(e):(this.data_=new Uint8Array(e.byteLength),this.data_.set(new Uint8Array(e))),r=this.data_.length):e instanceof Uint8Array&&(t?this.data_=e:(this.data_=new Uint8Array(e.length),this.data_.set(e)),r=e.length),this.size_=r,this.type_=n}size(){return this.size_}type(){return this.type_}slice(e,t){if(!A(this.data_))return new L(new Uint8Array(this.data_.buffer,e,t-e),!0);{var r;let n=(r=this.data_).webkitSlice?r.webkitSlice(e,t):r.mozSlice?r.mozSlice(e,t):r.slice?r.slice(e,t):null;return null===n?null:new L(n)}}static getBlob(...e){if(x()){let t=e.map(e=>e instanceof L?e.data_:e);return new L(k.apply(null,t))}{let t=e.map(e=>T(e)?function(e,t){switch(e){case U.RAW:return new O(P(t));case U.BASE64:case U.BASE64URL:return new O(S(e,t));case U.DATA_URL:return new O(function(e){let t=new D(e);return t.base64?S(U.BASE64,t.rest):function(e){let t;try{t=decodeURIComponent(e)}catch(e){throw E(U.DATA_URL,"Malformed data URL.")}return P(t)}(t.rest)}(t),new D(t).contentType)}throw g()}(U.RAW,e).data:e.data_),r=0;t.forEach(e=>{r+=e.byteLength});let n=new Uint8Array(r),s=0;return t.forEach(e=>{for(let t=0;t<e.length;t++)n[s++]=e[t]}),new L(n,!0)}}uploadData(){return this.data_}}function B(e){let t=e.lastIndexOf("/",e.length-2);return -1===t?e:e.slice(t+1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function j(e,t){return t}class q{constructor(e,t,r,n){this.server=e,this.local=t||e,this.writable=!!r,this.xform=n||j}}let F=null;class M{constructor(e,t,r,n){this.url=e,this.method=t,this.handler=r,this.timeout=n,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function $(e){if(!e)throw g()}function V(e){return function(t,r){var s,o;let i;return 401===t.getStatus()?i=t.getErrorText().includes("Firebase App Check token is invalid")?new f(n.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project."):new f(n.UNAUTHENTICATED,"User is not authenticated, please authenticate using Firebase Authentication and try again."):402===t.getStatus()?(s=e.bucket,i=new f(n.QUOTA_EXCEEDED,"Quota for bucket '"+s+"' exceeded, please view quota on https://firebase.google.com/pricing/.")):403===t.getStatus()?(o=e.path,i=new f(n.UNAUTHORIZED,"User does not have permission to access '"+o+"'.")):i=r,i.status=t.getStatus(),i.serverResponse=r.serverResponse,i}}let z={RUNNING:"running",PAUSED:"paused",SUCCESS:"success",CANCELED:"canceled",ERROR:"error"};class K{constructor(){this.errorText_="",this.sent_=!1,this.fetch_=h.fetch,this.errorCode_=s.NO_ERROR}async send(e,t,r,n){if(this.sent_)throw w("cannot .send() more than once");this.sent_=!0;try{let o=await this.fetch_(e,{method:t,headers:n||{},body:r});this.headers_=o.headers,this.statusCode_=o.status,this.errorCode_=s.NO_ERROR,this.body_=await o.arrayBuffer()}catch(e){this.errorText_=null==e?void 0:e.message,this.statusCode_=0,this.errorCode_=s.NETWORK_ERROR}}getErrorCode(){if(void 0===this.errorCode_)throw w("cannot .getErrorCode() before receiving response");return this.errorCode_}getStatus(){if(void 0===this.statusCode_)throw w("cannot .getStatus() before receiving response");return this.statusCode_}getErrorText(){return this.errorText_}abort(){}getResponseHeader(e){if(!this.headers_)throw w("cannot .getResponseHeader() before receiving response");return this.headers_.get(e)}addUploadProgressListener(e){}removeUploadProgressListener(e){}}class X extends K{getResponse(){if(!this.body_)throw w("cannot .getResponse() before receiving response");return Buffer.from(this.body_).toString("utf-8")}}function G(){return new X}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class H{constructor(e,t){this._service=e,t instanceof v?this._location=t:this._location=v.makeFromUrl(t,e.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(e,t){return new H(e,t)}get root(){let e=new v(this._location.bucket,"");return this._newRef(this._service,e)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return B(this._location.path)}get storage(){return this._service}get parent(){let e=/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function(e){if(0===e.length)return null;let t=e.lastIndexOf("/");return -1===t?"":e.slice(0,t)}(this._location.path);if(null===e)return null;let t=new v(this._location.bucket,e);return new H(this._service,t)}_throwIfRoot(e){if(""===this._location.path)throw new f(n.INVALID_ROOT_OPERATION,"The operation '"+e+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}}function W(e,t){let r=null==t?void 0:t[_];return null==r?null:v.makeFromBucketSpec(r,e)}class Z{constructor(e,t,r,n,s){this.app=e,this._authProvider=t,this._appCheckProvider=r,this._url=n,this._firebaseVersion=s,this._bucket=null,this._host=p,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=12e4,this._maxUploadRetryTime=6e5,this._requests=new Set,null!=n?this._bucket=v.makeFromBucketSpec(n,this._host):this._bucket=W(this._host,this.app.options)}get host(){return this._host}set host(e){this._host=e,null!=this._url?this._bucket=v.makeFromBucketSpec(this._url,e):this._bucket=W(e,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(e){I("time",0,Number.POSITIVE_INFINITY,e),this._maxUploadRetryTime=e}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(e){I("time",0,Number.POSITIVE_INFINITY,e),this._maxOperationRetryTime=e}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;let e=this._authProvider.getImmediate({optional:!0});if(e){let t=await e.getToken();if(null!==t)return t.accessToken}return null}async _getAppCheckToken(){let e=this._appCheckProvider.getImmediate({optional:!0});return e?(await e.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(e=>e.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(e){return new H(this,e)}_makeRequest(e,t,r,n,s=!0){if(this._deleted)return new y(R());{let o=function(e,t,r,n,s,o,i=!0){let a=function(e){let t=encodeURIComponent,r="?";for(let n in e)e.hasOwnProperty(n)&&(r=r+(t(n)+"=")+t(e[n])+"&");return r.slice(0,-1)}(e.urlParams),l=e.url+a,u=Object.assign({},e.headers);return t&&(u["X-Firebase-GMPID"]=t),null!==r&&r.length>0&&(u.Authorization="Firebase "+r),u["X-Firebase-Storage-Version"]="webjs/"+(null!=o?o:"AppManager"),null!==n&&(u["X-Firebase-AppCheck"]=n),new N(l,e.method,u,e.body,e.successCodes,e.additionalRetryCodes,e.handler,e.errorHandler,e.timeout,e.progressCallback,s,i)}(e,this._appId,r,n,t,this._firebaseVersion,s);return this._requests.add(o),o.getPromise().then(()=>this._requests.delete(o),()=>this._requests.delete(o)),o}}async makeRequestWithTokens(e,t){let[r,n]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(e,t,r,n).getPromise()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let J="storage";(0,u.Xd)(new d.wA(J,function(e,{instanceIdentifier:t}){return new Z(e.getProvider("app").getImmediate(),e.getProvider("auth-internal"),e.getProvider("app-check-internal"),t,u.Jn)},"PUBLIC").setMultipleInstances(!0)),(0,u.KN)("@firebase/storage","0.13.2");var Y=r(9077);function Q(){let{jobId:e}=(0,a.useParams)(),t=(0,a.useRouter)(),[r,s]=(0,i.useState)(null),[h,d]=(0,i.useState)({fullName:"",email:"",phone:"",links:"",coverLetter:""}),[p,m]=(0,i.useState)(!1),g=async s=>{if(s.preventDefault(),p)return;m(!0);let o=(0,l.ad)(Y.l),i=function(e=(0,u.Mq)(),t){e=(0,c.m9)(e);let r=(0,u.qX)(e,J).getImmediate({identifier:void 0}),n=(0,c.P0)("storage");return n&&function(e,t,r,n={}){!function(e,t,r,n={}){e.host=`${t}:${r}`,e._protocol="http";let{mockUserToken:s}=n;s&&(e._overrideAuthToken="string"==typeof s?s:(0,c.Sg)(s,e.app.options.projectId))}(e,t,r,n)}(r,...n),r}(Y.l),a="";if(r){var d,g;let e=`resumes/${Date.now()}_${r.name}`,t=(d=i,function(e,t){if(!(t&&/^[A-Za-z]+:\/\//.test(t)))return function e(t,r){if(t instanceof Z){if(null==t._bucket)throw new f(n.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+_+"' property when initializing the app?");let s=new H(t,t._bucket);return null!=r?e(s,r):s}return void 0!==r?function(e,t){let r=function(e,t){let r=t.split("/").filter(e=>e.length>0).join("/");return 0===e.length?r:e+"/"+r}(e._location.path,t),n=new v(e._location.bucket,r);return new H(e.storage,n)}(t,r):t}(e,t);if(e instanceof Z)return new H(e,t);throw b("To use ref(service, url), the first argument must be a Storage instance.")}(d=(0,c.m9)(d),e));await (g=t,function(e,t,r){e._throwIfRoot("uploadBytes");let s=function(e,t,r,s,o){var i,a,l,u,c;let h,d=t.bucketOnlyServerUrl(),p={"X-Goog-Upload-Protocol":"multipart"},_=function(){let e="";for(let t=0;t<2;t++)e+=Math.random().toString().slice(2);return e}();p["Content-Type"]="multipart/related; boundary="+_;let m=function(e,t,r){let n=Object.assign({},r);return n.fullPath=e.path,n.size=t.size(),!n.contentType&&(n.contentType=t&&t.type()||"application/octet-stream"),n}(t,s,o),g="--"+_+"\r\nContent-Type: application/json; charset=utf-8\r\n\r\n"+function(e,t){let r={},n=t.length;for(let s=0;s<n;s++){let n=t[s];n.writable&&(r[n.server]=e[n.local])}return JSON.stringify(r)}(m,r)+"\r\n--"+_+"\r\nContent-Type: "+m.contentType+"\r\n\r\n",b=L.getBlob(g,s,"\r\n--"+_+"--");if(null===b)throw new f(n.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.");let R={name:m.fullPath},E=(i=d,a=e.host,l=e._protocol,h=a,null==l&&(h=`https://${a}`),`${l}://${h}/v0${i}`),w=e.maxUploadRetryTime,y=new M(E,"POST",(u=e,c=r,function(e,t){let r=function(e,t,r){let n=/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function(e){var t;let r;try{r=JSON.parse(e)}catch(e){return null}return"object"!=typeof(t=r)||Array.isArray(t)?null:r}(t);return null===n?null:function(e,t,r){let n={};n.type="file";let s=r.length;for(let e=0;e<s;e++){let s=r[e];n[s.local]=s.xform(n,t[s.server])}return Object.defineProperty(n,"ref",{get:function(){let t=new v(n.bucket,n.fullPath);return e._makeStorageReference(t)}}),n}(e,n,r)}(u,t,c);return $(null!==r),r}),w);return y.urlParams=R,y.headers=p,y.body=b.uploadData(),y.errorHandler=V(t),y}(e.storage,e._location,function(){if(F)return F;let e=[];e.push(new q("bucket")),e.push(new q("generation")),e.push(new q("metageneration")),e.push(new q("name","fullPath",!0));let t=new q("name");t.xform=function(e,t){return!T(t)||t.length<2?t:B(t)},e.push(t);let r=new q("size");return r.xform=function(e,t){return void 0!==t?Number(t):t},e.push(r),e.push(new q("timeCreated")),e.push(new q("updated")),e.push(new q("md5Hash",null,!0)),e.push(new q("cacheControl",null,!0)),e.push(new q("contentDisposition",null,!0)),e.push(new q("contentEncoding",null,!0)),e.push(new q("contentLanguage",null,!0)),e.push(new q("contentType",null,!0)),e.push(new q("metadata","customMetadata",!0)),F=e}(),new L(t,!0),r);return e.storage.makeRequestWithTokens(s,G).then(t=>({metadata:t,ref:e}))}(g=(0,c.m9)(g),r,void 0)),a=e}await (0,l.ET)((0,l.hJ)(o,"applications"),{jobId:String(e),fullName:h.fullName,email:h.email,phone:h.phone,links:h.links.split(",").map(e=>e.trim()).filter(Boolean),coverLetter:h.coverLetter,resumePath:a,source:"urai.app",createdAt:(0,l.Bt)()}),t.push("/jobs")};return(0,o.jsxs)("main",{className:"mx-auto max-w-2xl p-6",children:[o.jsx("h1",{className:"text-2xl font-semibold mb-2",children:"Apply"}),(0,o.jsxs)("form",{onSubmit:g,className:"grid gap-4",children:[o.jsx("input",{className:"border p-2 rounded-xl",placeholder:"Full name",value:h.fullName,onChange:e=>d({...h,fullName:e.target.value})}),o.jsx("input",{className:"border p-2 rounded-xl",placeholder:"Email",value:h.email,onChange:e=>d({...h,email:e.target.value})}),o.jsx("input",{className:"border p-2 rounded-xl",placeholder:"Phone",value:h.phone,onChange:e=>d({...h,phone:e.target.value})}),o.jsx("input",{className:"border p-2 rounded-xl",placeholder:"Links (comma separated)",value:h.links,onChange:e=>d({...h,links:e.target.value})}),o.jsx("textarea",{className:"border p-2 rounded-xl min-h-40",placeholder:"Cover letter",value:h.coverLetter,onChange:e=>d({...h,coverLetter:e.target.value})}),o.jsx("input",{type:"file",accept:"application/pdf",onChange:e=>s(e.target.files?.[0]||null)}),o.jsx("button",{disabled:p,className:"rounded-xl border px-4 py-2",children:"Submit"})]})]})}},9077:(e,t,r)=>{"use strict";r.d(t,{l:()=>o});var n=r(3070);/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */(0,n.KN)("firebase","10.14.1","app");let s={apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,messagingSenderId:process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID},o=(0,n.C6)().length?(0,n.C6)()[0]:(0,n.ZF)(s)},1043:(e,t,r)=>{"use strict";var n=r(2854);r.o(n,"useParams")&&r.d(t,{useParams:function(){return n.useParams}}),r.o(n,"useRouter")&&r.d(t,{useRouter:function(){return n.useRouter}})},7431:(e,t,r)=>{"use strict";r.r(t),r.d(t,{$$typeof:()=>i,__esModule:()=>o,default:()=>a});var n=r(3189);let s=(0,n.createProxy)(String.raw`/home/user/urai-jobs/apps/web/app/apply/[jobId]/page.tsx`),{__esModule:o,$$typeof:i}=s;s.default;let a=(0,n.createProxy)(String.raw`/home/user/urai-jobs/apps/web/app/apply/[jobId]/page.tsx#default`)},2567:(e,t,r)=>{"use strict";r.r(t),r.d(t,{default:()=>o,metadata:()=>s});var n=r(9013);r(1);let s={title:"URAI Jobs",description:"Job board for URAI"};function o({children:e}){return n.jsx("html",{lang:"en",children:n.jsx("body",{children:e})})}},1:()=>{}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[592,990],()=>r(1968));module.exports=n})();