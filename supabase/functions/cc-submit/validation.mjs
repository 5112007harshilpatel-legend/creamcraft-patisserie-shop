export const MAX_IMAGE=5*1024*1024;
export function validate(d){
 const text=(k,min,max)=>{if(typeof d[k]!=='string')throw Error(`Invalid ${k}`);const v=d[k].trim();if(v.length<min||v.length>max)throw Error(`Invalid ${k}`);return v;};
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.id||''))throw Error('Invalid request ID');
 if(d.website)throw Error('Submission rejected');
 if(!['order','contact'].includes(d.kind))throw Error('Invalid form');
 const r={id:d.id,name:text('name',1,100),email:text('email',3,254).toLowerCase()};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))throw Error('Enter a valid email');
 if(d.kind==='contact')return {...r,message:text('message',1,3000)};
 const event_date=text('date',10,10),dt=new Date(event_date+'T00:00:00Z');
 const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(event_date)||!Number.isFinite(+dt)||dt.toISOString().slice(0,10)!==event_date||event_date<today||+dt>Date.now()+366*3*86400000)throw Error('Choose a valid date within the next 3 years');
 const occasion=text('occasion',1,100),flavour=text('flavour',1,100),size=text('size',1,100);
 if(!['Birthday','Wedding','Anniversary','Just because','Something else'].includes(occasion))throw Error('Invalid occasion');
 if(!['Madagascar vanilla & berry','Dark chocolate & salted caramel','Pistachio & rose','Lemon & elderflower'].includes(flavour))throw Error('Invalid flavour');
 if(!['6 inch · 6–8 servings','8 inch · 12–16 servings','10 inch · 20–24 servings',"Tiered · Let's discuss"].includes(size))throw Error('Invalid size');
 return {...r,occasion,event_date,flavour,size,dietary:text('dietary',0,300),notes:text('notes',0,2000)};
}
export function imageType(b){
 if(b.length<12||b.length>MAX_IMAGE)throw Error('Image must be JPG, PNG or WebP, maximum 5 MB');
 if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';
 if(new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP')return 'image/webp';
 throw Error('Image content is not JPG, PNG or WebP');
}
