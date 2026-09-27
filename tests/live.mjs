// Node 20+. Creates labelled QA records; IDs printed for owner cleanup.
// No secret key required. Set CC_URL / CC_KEY to override the bundled project.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const sandbox={window:{}};vm.runInNewContext(readFileSync(new URL('../config.js',import.meta.url),'utf8'),sandbox);
const url=process.env.CC_URL||sandbox.window.CC_CONFIG.SUPABASE_URL,key=process.env.CC_KEY||sandbox.window.CC_CONFIG.SUPABASE_PUBLISHABLE_KEY;
const headers={apikey:key};const email=`qa-${crypto.randomUUID()}@example.com`;
const base={kind:'order',id:crypto.randomUUID(),name:'[QA] Backend test',email,occasion:'Birthday',date:new Date(Date.now()+86400000*7).toISOString().slice(0,10),flavour:'Madagascar vanilla & berry',size:'6 inch · 6–8 servings',dietary:'',notes:'Automated QA record',status:'completed'};
async function send(data,file){const body=new FormData();for(const [k,v]of Object.entries(data))body.set(k,v);if(file)body.set('reference',file,'reference.png');const r=await fetch(url+'/functions/v1/cc-submit',{method:'POST',headers,body});return {status:r.status,body:await r.json()};}
const a=await send(base);assert.equal(a.status,201,JSON.stringify(a));console.log('PASS order',base.id);
const retry=await send(base);assert.equal(retry.status,200);assert.equal(retry.body.id,base.id);console.log('PASS duplicate retry');
assert.equal((await send({...base,notes:'changed'})).status,409);console.log('PASS duplicate conflict');
const imageId=crypto.randomUUID(),png=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZSsAAAAASUVORK5CYII=','base64')],{type:'image/png'});
assert.equal((await send({...base,id:imageId},png)).status,201);console.log('PASS private image upload',imageId);
const digest=Buffer.from(await crypto.subtle.digest('SHA-256',await png.arrayBuffer())).toString('hex');
for(const mode of ['public','authenticated']){const r=await fetch(url+'/storage/v1/object/'+mode+'/cc-references/'+imageId+'/'+digest+'.png',{headers});assert.ok(!r.ok);console.log('PASS anonymous image download blocked',mode);}
const directUpload=await fetch(url+'/storage/v1/object/cc-references/forbidden.png',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:png});assert.ok(!directUpload.ok);console.log('PASS direct image upload blocked');
assert.equal((await send({...base,id:crypto.randomUUID()},new Blob(['<svg>not png</svg>'],{type:'image/png'}))).status,400);console.log('PASS spoofed image blocked');
assert.equal((await send({...base,id:crypto.randomUUID()},new Blob([new Uint8Array(5242881)],{type:'image/png'}))).status,400);console.log('PASS oversized image blocked');
const contactId=crypto.randomUUID();assert.equal((await send({kind:'contact',id:contactId,name:'[QA] Contact',email,message:'QA contact test'})).status,201);console.log('PASS contact',contactId);
assert.equal((await send({...base,id:crypto.randomUUID(),email:'invalid'})).status,400);console.log('PASS invalid email blocked');
for(const table of ['cc_orders','cc_messages']){const r=await fetch(url+'/rest/v1/'+table+'?select=*',{headers});assert.ok([401,403].includes(r.status));console.log('PASS anonymous read blocked',table);}
const write=await fetch(url+'/rest/v1/cc_orders',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID()})});assert.ok([401,403].includes(write.status));console.log('PASS direct anonymous insert blocked');
const list=await fetch(url+'/storage/v1/object/list/cc-references',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({prefix:''})});if(list.ok)assert.deepEqual(await list.json(),[]);else assert.ok([400,401,403].includes(list.status));console.log('PASS anonymous storage listing blocked/empty');
const rate=await fetch(url+'/rest/v1/rpc/cc_rate_limit',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({email_hash:'a'.repeat(64)})});assert.ok([401,403,404].includes(rate.status));console.log('PASS private rate RPC denied');
for(let i=0;i<2;i++)assert.equal((await send({kind:'contact',id:crypto.randomUUID(),name:'[QA] Rate test',email,message:'QA rate test'})).status,201);
assert.equal((await send({kind:'contact',id:crypto.randomUUID(),name:'[QA] Rate test',email,message:'QA rate test'})).status,429);console.log('PASS sixth new email submission rate-limited');
console.log('QA_EMAIL='+email);
