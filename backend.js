window.CCBackend={
 async submit(form,kind){
  const cfg=window.CC_CONFIG;if(!cfg?.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_PUBLISHABLE_KEY.startsWith('YOUR_'))throw Error('Enquiries are not configured yet. Please try again later.');
  const data=new FormData(form);data.set('kind',kind);
  // Persist only an opaque random key, never customer data. Keep it on failures/reload.
  const storageKey='cc-request-'+kind;let id;
  try{id=sessionStorage.getItem(storageKey);}catch{}
  if(!id){id=crypto.randomUUID();try{sessionStorage.setItem(storageKey,id);}catch{}}
  form.dataset.requestId ||= id;data.set('id',form.dataset.requestId);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
   const r=await fetch(cfg.SUPABASE_URL+'/functions/v1/cc-submit',{method:'POST',headers:{apikey:cfg.SUPABASE_PUBLISHABLE_KEY},body:data,signal:controller.signal});
   const body=await r.json();if(!r.ok||!body.ok)throw Error(body.error||'Unable to confirm save. Please retry.');
   try{sessionStorage.removeItem(storageKey);}catch{}return body;
  }catch(e){if(e.name==='AbortError')throw Error('Connection timed out. Retry the same form to safely confirm your enquiry.');throw e;}finally{clearTimeout(timer);}
 }
};
