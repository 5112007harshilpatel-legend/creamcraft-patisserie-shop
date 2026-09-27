import {validate,imageType,MAX_IMAGE} from './validation.mjs';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:key,Authorization:`Bearer ${key}`};
const hash=async (b:BufferSource)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
const encode=(s:string)=>new TextEncoder().encode(s);
Deno.serve(async(req)=>{
 const origin=req.headers.get('origin')||'';
 const allowed=(Deno.env.get('CC_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 const cors={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'*','Access-Control-Allow-Headers':'apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store',...(status===429?{'Retry-After':'3600'}:{})}});
 if(origin&&allowed.length&&!allowed.includes(origin))return reply(403,{error:'This website origin is not enabled'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 try{
  // Bound streamed bytes even when Content-Length is absent or forged.
  const reader=req.body?.getReader();if(!reader)return reply(400,{error:'Form required'});
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_IMAGE+65536){await reader.cancel();return reply(413,{error:'Request too large'});}chunks.push(value);}
  const fd=await new Response(new Blob(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();
  const d=Object.fromEntries(fd);let row;try{row=validate(d);}catch(e){return reply(400,{error:e.message});}
  const table=d.kind==='order'?'cc_orders':'cc_messages';
  const file=fd.get('reference');let bytes:Uint8Array|undefined,mime='';
  if(file instanceof File&&file.size){if(d.kind!=='order')return reply(400,{error:'Contact images are not supported'});bytes=new Uint8Array(await file.arrayBuffer());try{mime=imageType(bytes);if(file.type!==mime)throw Error('Image type does not match its content');}catch(e){return reply(400,{error:e.message});}}
  const digest=bytes?await hash(bytes):'';
  const fingerprint=await hash(encode(JSON.stringify(row)+digest));
  const rest=async(path:string,init:RequestInit={})=>fetch(url+'/rest/v1/'+path,{...init,headers:{...headers,'Content-Type':'application/json',...init.headers}});
  const lookup=await rest(`${table}?id=eq.${row.id}&select=fingerprint`);if(!lookup.ok)throw Error('lookup');
  const existing=await lookup.json();if(existing.length)return existing[0].fingerprint===fingerprint?reply(200,{ok:true,id:row.id}):reply(409,{error:'This request was already used. Reload to start a new enquiry.'});
  const limit=await rest('rpc/cc_rate_limit',{method:'POST',body:JSON.stringify({email_hash:await hash(encode(row.email))})});
  if(!limit.ok)throw Error('limit');if(await limit.json()!==true)return reply(429,{error:'Too many submissions. Please try again after an hour.'});
  let path:string|null=null;
  if(bytes){path=`${row.id}/${digest}.${mime==='image/jpeg'?'jpg':mime==='image/png'?'png':'webp'}`;
   const upload=await fetch(`${url}/storage/v1/object/cc-references/${path}`,{method:'POST',headers:{...headers,'Content-Type':mime,'x-upsert':'false'},body:bytes});
   if(!upload.ok){const err=await upload.json();if(String(err.statusCode)!=='409'&&err.error!=='Duplicate')throw Error('upload');}
  }
  const payload={...row,fingerprint,...(d.kind==='order'?{reference_path:path,status:'pending'}:{})};
  const saved=await rest(table,{method:'POST',body:JSON.stringify(payload)});
  if(saved.status===409){const again=await rest(`${table}?id=eq.${row.id}&select=fingerprint`);const found=await again.json();if(found[0]?.fingerprint===fingerprint)return reply(200,{ok:true,id:row.id});return reply(409,{error:'Request conflict. Reload to start again.'});}
  if(!saved.ok)throw Error('save');
  return reply(201,{ok:true,id:row.id});
 }catch{ return reply(503,{error:'Could not confirm your save. Please retry with the same form; duplicate enquiries are prevented.'}); }
});
