"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[437],{7754:function(e,t,n){var r=n(534);n.o(r,"useParams")&&n.d(t,{useParams:function(){return r.useParams}}),n.o(r,"useRouter")&&n.d(t,{useRouter:function(){return r.useRouter}})},6334:function(e,t,n){n.d(t,{cF:function(){return G},iH:function(){return Z},KV:function(){return X}});var r,s,i,o,a=n(9451),l=n(340),u=n(2890);/**
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
 */let h="firebasestorage.googleapis.com",c="storageBucket";/**
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
 */class d extends l.ZR{constructor(e,t,n=0){super(p(e),`Firebase Storage: ${t} (${p(e)})`),this.status_=n,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,d.prototype)}get status(){return this.status_}set status(e){this.status_=e}_codeEquals(e){return p(e)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(e){this.customData.serverResponse=e,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}function p(e){return"storage/"+e}function _(){return new d(i.UNKNOWN,"An unknown error occurred, please check the error payload for server response.")}function f(e){return new d(i.INVALID_ARGUMENT,e)}function g(){return new d(i.APP_DELETED,"The Firebase app was deleted.")}function m(e,t){return new d(i.INVALID_FORMAT,"String does not match format '"+e+"': "+t)}function b(e){throw new d(i.INTERNAL_ERROR,"Internal error: "+e)}(r=i||(i={})).UNKNOWN="unknown",r.OBJECT_NOT_FOUND="object-not-found",r.BUCKET_NOT_FOUND="bucket-not-found",r.PROJECT_NOT_FOUND="project-not-found",r.QUOTA_EXCEEDED="quota-exceeded",r.UNAUTHENTICATED="unauthenticated",r.UNAUTHORIZED="unauthorized",r.UNAUTHORIZED_APP="unauthorized-app",r.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",r.INVALID_CHECKSUM="invalid-checksum",r.CANCELED="canceled",r.INVALID_EVENT_NAME="invalid-event-name",r.INVALID_URL="invalid-url",r.INVALID_DEFAULT_BUCKET="invalid-default-bucket",r.NO_DEFAULT_BUCKET="no-default-bucket",r.CANNOT_SLICE_BLOB="cannot-slice-blob",r.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",r.NO_DOWNLOAD_URL="no-download-url",r.INVALID_ARGUMENT="invalid-argument",r.INVALID_ARGUMENT_COUNT="invalid-argument-count",r.APP_DELETED="app-deleted",r.INVALID_ROOT_OPERATION="invalid-root-operation",r.INVALID_FORMAT="invalid-format",r.INTERNAL_ERROR="internal-error",r.UNSUPPORTED_ENVIRONMENT="unsupported-environment";/**
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
 */class w{constructor(e,t){this.bucket=e,this.path_=t}get path(){return this.path_}get isRoot(){return 0===this.path.length}fullServerUrl(){let e=encodeURIComponent;return"/b/"+e(this.bucket)+"/o/"+e(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(e,t){let n;try{n=w.makeFromUrl(e,t)}catch(t){return new w(e,"")}if(""===n.path)return n;throw new d(i.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+e+"'.")}static makeFromUrl(e,t){let n=null,r="([A-Za-z0-9.\\-_]+)",s=RegExp("^gs://"+r+"(/(.*))?$","i");function o(e){e.path_=decodeURIComponent(e.path)}let a=t.replace(/[.]/g,"\\."),l=[{regex:s,indices:{bucket:1,path:3},postModify:function(e){"/"===e.path.charAt(e.path.length-1)&&(e.path_=e.path_.slice(0,-1))}},{regex:RegExp(`^https?://${a}/v[A-Za-z0-9_]+/b/${r}/o(/([^?#]*).*)?$`,"i"),indices:{bucket:1,path:3},postModify:o},{regex:RegExp(`^https?://${t===h?"(?:storage.googleapis.com|storage.cloud.google.com)":t}/${r}/([^?#]*)`,"i"),indices:{bucket:1,path:2},postModify:o}];for(let t=0;t<l.length;t++){let r=l[t],s=r.regex.exec(e);if(s){let e=s[r.indices.bucket],t=s[r.indices.path];t||(t=""),n=new w(e,t),r.postModify(n);break}}if(null==n)throw new d(i.INVALID_URL,"Invalid URL '"+e+"'.");return n}}class R{constructor(e){this.promise_=Promise.reject(e)}getPromise(){return this.promise_}cancel(e=!1){}}function E(e){return"string"==typeof e||e instanceof String}function T(e){return A()&&e instanceof Blob}function A(){return"undefined"!=typeof Blob}function k(e,t,n,r){if(r<t)throw f(`Invalid value for '${e}'. Expected ${t} or greater.`);if(r>n)throw f(`Invalid value for '${e}'. Expected ${n} or less.`)}(s=o||(o={}))[s.NO_ERROR=0]="NO_ERROR",s[s.NETWORK_ERROR=1]="NETWORK_ERROR",s[s.ABORT=2]="ABORT";/**
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
 */class y{constructor(e,t,n,r,s,i,o,a,l,u,h,c=!0){this.url_=e,this.method_=t,this.headers_=n,this.body_=r,this.successCodes_=s,this.additionalRetryCodes_=i,this.callback_=o,this.errorCallback_=a,this.timeout_=l,this.progressCallback_=u,this.connectionFactory_=h,this.retry=c,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((e,t)=>{this.resolve_=e,this.reject_=t,this.start_()})}start_(){let e=(e,t)=>{let n=this.resolve_,r=this.reject_,s=t.connection;if(t.wasSuccessCode)try{let e=this.callback_(s,s.getResponse());void 0!==e?n(e):n()}catch(e){r(e)}else if(null!==s){let e=_();e.serverResponse=s.getErrorText(),r(this.errorCallback_?this.errorCallback_(s,e):e)}else r(t.canceled?this.appDelete_?g():new d(i.CANCELED,"User canceled the upload/download."):new d(i.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again."))};this.canceled_?e(!1,new O(!1,null,!0)):this.backoffId_=/**
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
 */function(e,t,n){let r=1,s=null,i=null,o=!1,a=0,l=!1;function u(...e){l||(l=!0,t.apply(null,e))}function h(t){s=setTimeout(()=>{s=null,e(d,2===a)},t)}function c(){i&&clearTimeout(i)}function d(e,...t){let n;if(l){c();return}if(e||2===a||o){c(),u.call(null,e,...t);return}r<64&&(r*=2),1===a?(a=2,n=0):n=(r+Math.random())*1e3,h(n)}let p=!1;function _(e){!p&&(p=!0,c(),!l&&(null!==s?(e||(a=2),clearTimeout(s),h(0)):e||(a=1)))}return h(0),i=setTimeout(()=>{o=!0,_(!0)},n),_}((e,t)=>{if(t){e(!1,new O(!1,null,!0));return}let n=this.connectionFactory_();this.pendingConnection_=n;let r=e=>{let t=e.loaded,n=e.lengthComputable?e.total:-1;null!==this.progressCallback_&&this.progressCallback_(t,n)};null!==this.progressCallback_&&n.addUploadProgressListener(r),n.send(this.url_,this.method_,this.body_,this.headers_).then(()=>{null!==this.progressCallback_&&n.removeUploadProgressListener(r),this.pendingConnection_=null;let t=n.getErrorCode()===o.NO_ERROR,s=n.getStatus();if(!t||/**
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
 */function(e,t){let n=e>=500&&e<600,r=-1!==[408,429].indexOf(e),s=-1!==t.indexOf(e);return n||r||s}(s,this.additionalRetryCodes_)&&this.retry){e(!1,new O(!1,null,n.getErrorCode()===o.ABORT));return}e(!0,new O(-1!==this.successCodes_.indexOf(s),n))})},e,this.timeout_)}getPromise(){return this.promise_}cancel(e){this.canceled_=!0,this.appDelete_=e||!1,null!==this.backoffId_&&(0,this.backoffId_)(!1),null!==this.pendingConnection_&&this.pendingConnection_.abort()}}class O{constructor(e,t,n){this.wasSuccessCode=e,this.connection=t,this.canceled=!!n}}function I(...e){let t="undefined"!=typeof BlobBuilder?BlobBuilder:"undefined"!=typeof WebKitBlobBuilder?WebKitBlobBuilder:void 0;if(void 0!==t){let n=new t;for(let t=0;t<e.length;t++)n.append(e[t]);return n.getBlob()}if(A())return new Blob(e);throw new d(i.UNSUPPORTED_ENVIRONMENT,"This browser doesn't seem to support creating Blobs")}/**
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
 */let N={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"};class U{constructor(e,t){this.data=e,this.contentType=t||null}}function v(e){let t=[];for(let n=0;n<e.length;n++){let r=e.charCodeAt(n);r<=127?t.push(r):r<=2047?t.push(192|r>>6,128|63&r):(64512&r)==55296?n<e.length-1&&(64512&e.charCodeAt(n+1))==56320?(r=65536|(1023&r)<<10|1023&e.charCodeAt(++n),t.push(240|r>>18,128|r>>12&63,128|r>>6&63,128|63&r)):t.push(239,191,189):(64512&r)==56320?t.push(239,191,189):t.push(224|r>>12,128|r>>6&63,128|63&r)}return new Uint8Array(t)}function C(e,t){let n;switch(e){case N.BASE64:{let n=-1!==t.indexOf("-"),r=-1!==t.indexOf("_");if(n||r)throw m(e,"Invalid character '"+(n?"-":"_")+"' found: is it base64url encoded?");break}case N.BASE64URL:{let n=-1!==t.indexOf("+"),r=-1!==t.indexOf("/");if(n||r)throw m(e,"Invalid character '"+(n?"+":"/")+"' found: is it base64 encoded?");t=t.replace(/-/g,"+").replace(/_/g,"/")}}try{n=/**
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
 */function(e){if("undefined"==typeof atob)throw new d(i.UNSUPPORTED_ENVIRONMENT,"base-64 is missing. Make sure to install the required polyfills. See https://firebase.google.com/docs/web/environments-js-sdk#polyfills for more information.");return atob(e)}(t)}catch(t){if(t.message.includes("polyfill"))throw t;throw m(e,"Invalid character found")}let r=new Uint8Array(n.length);for(let e=0;e<n.length;e++)r[e]=n.charCodeAt(e);return r}class x{constructor(e){var t;this.base64=!1,this.contentType=null;let n=e.match(/^data:([^,]+)?,/);if(null===n)throw m(N.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");let r=n[1]||null;null!=r&&(this.base64=(t=";base64",r.length>=t.length&&r.substring(r.length-t.length)===t),this.contentType=this.base64?r.substring(0,r.length-7):r),this.rest=e.substring(e.indexOf(",")+1)}}/**
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
 */class D{constructor(e,t){let n=0,r="";T(e)?(this.data_=e,n=e.size,r=e.type):e instanceof ArrayBuffer?(t?this.data_=new Uint8Array(e):(this.data_=new Uint8Array(e.byteLength),this.data_.set(new Uint8Array(e))),n=this.data_.length):e instanceof Uint8Array&&(t?this.data_=e:(this.data_=new Uint8Array(e.length),this.data_.set(e)),n=e.length),this.size_=n,this.type_=r}size(){return this.size_}type(){return this.type_}slice(e,t){if(!T(this.data_))return new D(new Uint8Array(this.data_.buffer,e,t-e),!0);{var n;let r=(n=this.data_).webkitSlice?n.webkitSlice(e,t):n.mozSlice?n.mozSlice(e,t):n.slice?n.slice(e,t):null;return null===r?null:new D(r)}}static getBlob(...e){if(A()){let t=e.map(e=>e instanceof D?e.data_:e);return new D(I.apply(null,t))}{let t=e.map(e=>E(e)?function(e,t){switch(e){case N.RAW:return new U(v(t));case N.BASE64:case N.BASE64URL:return new U(C(e,t));case N.DATA_URL:return new U(function(e){let t=new x(e);return t.base64?C(N.BASE64,t.rest):function(e){let t;try{t=decodeURIComponent(e)}catch(e){throw m(N.DATA_URL,"Malformed data URL.")}return v(t)}(t.rest)}(t),new x(t).contentType)}throw _()}(N.RAW,e).data:e.data_),n=0;t.forEach(e=>{n+=e.byteLength});let r=new Uint8Array(n),s=0;return t.forEach(e=>{for(let t=0;t<e.length;t++)r[s++]=e[t]}),new D(r,!0)}}uploadData(){return this.data_}}function P(e){let t=e.lastIndexOf("/",e.length-2);return -1===t?e:e.slice(t+1)}/**
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
 */function L(e,t){return t}class S{constructor(e,t,n,r){this.server=e,this.local=t||e,this.writable=!!n,this.xform=r||L}}let B=null;class F{constructor(e,t,n,r){this.url=e,this.method=t,this.handler=n,this.timeout=r,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}class M{constructor(){this.sent_=!1,this.xhr_=new XMLHttpRequest,this.initXhr(),this.errorCode_=o.NO_ERROR,this.sendPromise_=new Promise(e=>{this.xhr_.addEventListener("abort",()=>{this.errorCode_=o.ABORT,e()}),this.xhr_.addEventListener("error",()=>{this.errorCode_=o.NETWORK_ERROR,e()}),this.xhr_.addEventListener("load",()=>{e()})})}send(e,t,n,r){if(this.sent_)throw b("cannot .send() more than once");if(this.sent_=!0,this.xhr_.open(t,e,!0),void 0!==r)for(let e in r)r.hasOwnProperty(e)&&this.xhr_.setRequestHeader(e,r[e].toString());return void 0!==n?this.xhr_.send(n):this.xhr_.send(),this.sendPromise_}getErrorCode(){if(!this.sent_)throw b("cannot .getErrorCode() before sending");return this.errorCode_}getStatus(){if(!this.sent_)throw b("cannot .getStatus() before sending");try{return this.xhr_.status}catch(e){return -1}}getResponse(){if(!this.sent_)throw b("cannot .getResponse() before sending");return this.xhr_.response}getErrorText(){if(!this.sent_)throw b("cannot .getErrorText() before sending");return this.xhr_.statusText}abort(){this.xhr_.abort()}getResponseHeader(e){return this.xhr_.getResponseHeader(e)}addUploadProgressListener(e){null!=this.xhr_.upload&&this.xhr_.upload.addEventListener("progress",e)}removeUploadProgressListener(e){null!=this.xhr_.upload&&this.xhr_.upload.removeEventListener("progress",e)}}class V extends M{initXhr(){this.xhr_.responseType="text"}}function $(){return new V}/**
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
 */class q{constructor(e,t){this._service=e,t instanceof w?this._location=t:this._location=w.makeFromUrl(t,e.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(e,t){return new q(e,t)}get root(){let e=new w(this._location.bucket,"");return this._newRef(this._service,e)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return P(this._location.path)}get storage(){return this._service}get parent(){let e=/**
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
 */function(e){if(0===e.length)return null;let t=e.lastIndexOf("/");return -1===t?"":e.slice(0,t)}(this._location.path);if(null===e)return null;let t=new w(this._location.bucket,e);return new q(this._service,t)}_throwIfRoot(e){if(""===this._location.path)throw new d(i.INVALID_ROOT_OPERATION,"The operation '"+e+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}}function z(e,t){let n=null==t?void 0:t[c];return null==n?null:w.makeFromBucketSpec(n,e)}class j{constructor(e,t,n,r,s){this.app=e,this._authProvider=t,this._appCheckProvider=n,this._url=r,this._firebaseVersion=s,this._bucket=null,this._host=h,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=12e4,this._maxUploadRetryTime=6e5,this._requests=new Set,null!=r?this._bucket=w.makeFromBucketSpec(r,this._host):this._bucket=z(this._host,this.app.options)}get host(){return this._host}set host(e){this._host=e,null!=this._url?this._bucket=w.makeFromBucketSpec(this._url,e):this._bucket=z(e,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(e){k("time",0,Number.POSITIVE_INFINITY,e),this._maxUploadRetryTime=e}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(e){k("time",0,Number.POSITIVE_INFINITY,e),this._maxOperationRetryTime=e}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;let e=this._authProvider.getImmediate({optional:!0});if(e){let t=await e.getToken();if(null!==t)return t.accessToken}return null}async _getAppCheckToken(){let e=this._appCheckProvider.getImmediate({optional:!0});return e?(await e.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(e=>e.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(e){return new q(this,e)}_makeRequest(e,t,n,r,s=!0){if(this._deleted)return new R(g());{let i=function(e,t,n,r,s,i,o=!0){let a=function(e){let t=encodeURIComponent,n="?";for(let r in e)e.hasOwnProperty(r)&&(n=n+(t(r)+"=")+t(e[r])+"&");return n.slice(0,-1)}(e.urlParams),l=e.url+a,u=Object.assign({},e.headers);return t&&(u["X-Firebase-GMPID"]=t),null!==n&&n.length>0&&(u.Authorization="Firebase "+n),u["X-Firebase-Storage-Version"]="webjs/"+(null!=i?i:"AppManager"),null!==r&&(u["X-Firebase-AppCheck"]=r),new y(l,e.method,u,e.body,e.successCodes,e.additionalRetryCodes,e.handler,e.errorHandler,e.timeout,e.progressCallback,s,o)}(e,this._appId,n,r,t,this._firebaseVersion,s);return this._requests.add(i),i.getPromise().then(()=>this._requests.delete(i),()=>this._requests.delete(i)),i}}async makeRequestWithTokens(e,t){let[n,r]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(e,t,n,r).getPromise()}}let H="@firebase/storage",K="0.13.2",W="storage";function X(e,t,n){return function(e,t,n){e._throwIfRoot("uploadBytes");let r=function(e,t,n,r,s){var o,a;let l;let u=t.bucketOnlyServerUrl(),h={"X-Goog-Upload-Protocol":"multipart"},c=function(){let e="";for(let t=0;t<2;t++)e+=Math.random().toString().slice(2);return e}();h["Content-Type"]="multipart/related; boundary="+c;let p=function(e,t,n){let r=Object.assign({},n);return r.fullPath=e.path,r.size=t.size(),!r.contentType&&(r.contentType=t&&t.type()||"application/octet-stream"),r}(t,r,s),f="--"+c+"\r\nContent-Type: application/json; charset=utf-8\r\n\r\n"+function(e,t){let n={},r=t.length;for(let s=0;s<r;s++){let r=t[s];r.writable&&(n[r.server]=e[r.local])}return JSON.stringify(n)}(p,n)+"\r\n--"+c+"\r\nContent-Type: "+p.contentType+"\r\n\r\n",g=D.getBlob(f,r,"\r\n--"+c+"--");if(null===g)throw new d(i.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.");let m={name:p.fullPath},b=new F((o=e.host,a=e._protocol,l=o,null==a&&(l=`https://${o}`),`${a}://${l}/v0${u}`),"POST",function(t,r){let s=function(e,t,n){let r=/**
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
 */function(e){var t;let n;try{n=JSON.parse(e)}catch(e){return null}return"object"!=typeof(t=n)||Array.isArray(t)?null:n}(t);return null===r?null:function(e,t,n){let r={};r.type="file";let s=n.length;for(let e=0;e<s;e++){let s=n[e];r[s.local]=s.xform(r,t[s.server])}return Object.defineProperty(r,"ref",{get:function(){let t=new w(r.bucket,r.fullPath);return e._makeStorageReference(t)}}),r}(e,r,n)}(e,r,n);return(/**
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
 */function(e){if(!e)throw _()}(null!==s),s)},e.maxUploadRetryTime);return b.urlParams=m,b.headers=h,b.body=g.uploadData(),b.errorHandler=function(e,n){var r,s;let o;return 401===e.getStatus()?o=e.getErrorText().includes("Firebase App Check token is invalid")?new d(i.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project."):new d(i.UNAUTHENTICATED,"User is not authenticated, please authenticate using Firebase Authentication and try again."):402===e.getStatus()?(r=t.bucket,o=new d(i.QUOTA_EXCEEDED,"Quota for bucket '"+r+"' exceeded, please view quota on https://firebase.google.com/pricing/.")):403===e.getStatus()?(s=t.path,o=new d(i.UNAUTHORIZED,"User does not have permission to access '"+s+"'.")):o=n,o.status=e.getStatus(),o.serverResponse=n.serverResponse,o},b}(e.storage,e._location,function(){if(B)return B;let e=[];e.push(new S("bucket")),e.push(new S("generation")),e.push(new S("metageneration")),e.push(new S("name","fullPath",!0));let t=new S("name");t.xform=function(e,t){return!E(t)||t.length<2?t:P(t)},e.push(t);let n=new S("size");return n.xform=function(e,t){return void 0!==t?Number(t):t},e.push(n),e.push(new S("timeCreated")),e.push(new S("updated")),e.push(new S("md5Hash",null,!0)),e.push(new S("cacheControl",null,!0)),e.push(new S("contentDisposition",null,!0)),e.push(new S("contentEncoding",null,!0)),e.push(new S("contentLanguage",null,!0)),e.push(new S("contentType",null,!0)),e.push(new S("metadata","customMetadata",!0)),B=e}(),new D(t,!0),n);return e.storage.makeRequestWithTokens(r,$).then(t=>({metadata:t,ref:e}))}(e=(0,l.m9)(e),t,n)}function Z(e,t){return function(e,t){if(!(t&&/^[A-Za-z]+:\/\//.test(t)))return function e(t,n){if(t instanceof j){if(null==t._bucket)throw new d(i.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+c+"' property when initializing the app?");let r=new q(t,t._bucket);return null!=n?e(r,n):r}return void 0!==n?function(e,t){let n=function(e,t){let n=t.split("/").filter(e=>e.length>0).join("/");return 0===e.length?n:e+"/"+n}(e._location.path,t),r=new w(e._location.bucket,n);return new q(e.storage,r)}(t,n):t}(e,t);if(e instanceof j)return new q(e,t);throw f("To use ref(service, url), the first argument must be a Storage instance.")}(e=(0,l.m9)(e),t)}function G(e=(0,a.Mq)(),t){e=(0,l.m9)(e);let n=(0,a.qX)(e,W).getImmediate({identifier:t}),r=(0,l.P0)("storage");return r&&function(e,t,n,r={}){!function(e,t,n,r={}){e.host=`${t}:${n}`,e._protocol="http";let{mockUserToken:s}=r;s&&(e._overrideAuthToken="string"==typeof s?s:(0,l.Sg)(s,e.app.options.projectId))}(e,t,n,r)}(n,...r),n}(0,a.Xd)(new u.wA(W,function(e,{instanceIdentifier:t}){return new j(e.getProvider("app").getImmediate(),e.getProvider("auth-internal"),e.getProvider("app-check-internal"),t,a.Jn)},"PUBLIC").setMultipleInstances(!0)),(0,a.KN)(H,K,""),(0,a.KN)(H,K,"esm2017")}}]);