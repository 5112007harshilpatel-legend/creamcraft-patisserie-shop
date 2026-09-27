# CrèmeCraft setup — simple Hindi-English

## 1. Abhi kya ready hai?

Aapka existing project `oawjzhjiglvnzepoofoc` use hua hai. Database tables, RLS, private image bucket aur `cc-submit` function already deploy ho chuke hain. `config.js` mein project URL aur safe publishable key set hain. Migration dobara run **mat** karna. SQL files version control/recovery/new project ke liye hain.

Order submit karne par status `pending` hoga. Yeh enquiry hai, confirmed booking nahi. Email delivery/payment/newsletter signup abhi enabled nahi hain.

## 2. Pehla admin banao — account-owner step (required)

1. Supabase Dashboard mein correct project open karo.
2. Authentication → Users → Add user / Create user kholo.
3. Apna real admin email aur strong password set karo. Password chat ya GitHub mein mat daalo. Dashboard ka confirmed/auto-confirm option use karo: email delivery ki zaroorat nahi.
4. Email/password provider enabled hona chahiye. Sirf staff login chahiye toh Auth settings mein public signup disable kar sakte ho; non-admin signup enabled ho tab bhi data access nahi milega.
5. Created user ka **User UID** copy karo.
6. SQL Editor mein sirf ye command run karo, placeholder ko actual UID se replace karke:

```sql
insert into cc_private.admins(user_id)
values ('PASTE_REAL_AUTH_USER_UUID_HERE'::uuid)
on conflict do nothing;
```

7. Website ka `/admin.html` open karo. Usi email/password se login karo.
8. Enquiries/messages dikhne chahiye. `View private reference` image kholta hai. Status change karne ke baad server confirm hone par “Order status saved” aayega.

Sirf Auth user banana enough nahi: UID allowlist mein add hona zaroori hai. `user_metadata.admin=true` se admin nahi banta. App mein signup/admin-grant button nahi hai.

Admin access remove karne ke liye owner SQL Editor se:

```sql
delete from cc_private.admins
where user_id = 'PASTE_REAL_AUTH_USER_UUID_HERE'::uuid;
```

Next server request se access block ho jayega. Pehle se dekhi/download ki hui information ko remotely erase nahi kiya ja sakta.

## 3. Website local run aur GitHub upload

1. ZIP extract karo.
2. Folder mein terminal: `python -m http.server 8080`.
3. Browser: `http://localhost:8080`.
4. GitHub repo mein **extracted files/folders** upload karo, ZIP alone nahi.
5. GitHub Pages Settings → Pages → main branch / root choose karo; HTTPS URL open karo.
6. `config.js` mein publishable key safe hai. `service_role`, secret key ya password kabhi frontend/repository mein mat add karo.

`config.example.js` mein placeholders hain. Dusre project ke liye in values ko replace karke `config.js` banao. Current project ki values already configured hain.

## 4. Production domain — account configuration

Final hosting URL abhi supplied nahi hai. Supabase → Edge Functions → Secrets mein:

- Name: `CC_ALLOWED_ORIGINS`
- Value example: `https://YOURNAME.github.io,http://localhost:8080`

Origin mein path/trailing slash mat daalo. GitHub Pages `/repo-name/` path origin ka part nahi hai. Custom domain ho toh woh origin bhi comma-separated add karo. Production ready hone par localhost remove kar sakte ho. Setting empty ho toh endpoint kisi origin se enquiry accept karta hai, lekin validation/rate limits/RLS active rehte hain. CORS ko security permission mat samjho; non-browser requests CORS se nahi rukte.

Built-in `SUPABASE_URL` aur `SUPABASE_SERVICE_ROLE_KEY` function runtime mein Supabase deta hai. Inhe frontend mein copy nahi karna. Koi paid email/payment service required nahi. Free tier ke quotas ke andar use kar sakte ho; quotas/paused project availability account par depend karte hain.

## 5. Function redeploy / new project setup

Current project already deployed hai. Sirf source change karne par redeploy karo.

Dashboard route: Edge Functions → `cc-submit` → edit/deploy. Function folder ke `index.ts` aur `validation.mjs` dono preserve karo. Legacy JWT verification OFF rakho: yeh intentionally public form endpoint hai; server validation, honeypot, rate limits aur body caps andar enforced hain. Admin reads is function se nahi, authenticated RLS se hote hain.

CLI route: Supabase CLI install/login karne ke baad `supabase --help`, `supabase link --help`, `supabase functions deploy --help` se installed version ke flags verify karo. Typical commands:

```sh
supabase login
supabase link --project-ref oawjzhjiglvnzepoofoc
supabase functions deploy cc-submit --no-verify-jwt
```

`supabase/config.toml` mein public function setting included hai. Project secrets Dashboard mein set kar sakte ho; shell history mein secret values paste karna avoid karo.

**New empty project only:** SQL Editor mein migration file run karo, Edge Function deploy karo, new project URL/publishable key config mein set karo, first admin authorize karo. Existing project par `db reset` ya destructive commands mat chalana.

## 6. Tests run karo

- `node --test tests/validation.test.mjs`: field/image validation, no remote writes.
- `node tests/live.mjs`: live order, image, contact, duplicate and unauthorized tests. Labelled QA data writes hoti hain; IDs/email output mein milta hai.
- `tests/access.sql`: SQL Editor mein full script run karo. Admin/nonadmin role assertions ka result PASS hona chahiye. Fixtures transaction rollback se remove ho jaate hain.
- First real admin banane ke baad login, image view, status save, refresh persistence aur logout manually verify karo.
- Incognito logged-out tab mein REST/Storage customer info accessible nahi hona chahiye.
- Slow/offline network mein form success nahi dikhna chahiye; same form retry safe hai.

## 7. QA data and maintenance

Delivery verification ne 2 `[QA] Backend test` orders (one with a 1-pixel PNG) aur 3 QA contact messages banaye. Exact test email:

`qa-c1a27033-1670-4b0b-8c9e-2f50877f96f6@example.com`

Inhe customer data se clearly alag label kiya hai. Remove karna ho toh pehle Storage dashboard se folder `cc-references/1f8168a5-ce4f-4389-bebf-c1487aed0690/` ka QA image delete karo. Phir owner SQL Editor se **sirf exact test email** ke rows delete karo:

```sql
delete from public.cc_orders where email='qa-c1a27033-1670-4b0b-8c9e-2f50877f96f6@example.com';
delete from public.cc_messages where email='qa-c1a27033-1670-4b0b-8c9e-2f50877f96f6@example.com';
```

Abandoned uploads inspect karne ka read-only query:

```sql
select o.name, o.created_at
from storage.objects o
where o.bucket_id='cc-references'
  and o.created_at < now()-interval '7 days'
  and not exists(select 1 from public.cc_orders q where q.reference_path=o.name);
```

Results review karke Storage dashboard/API se delete karo; `storage.objects` ko direct SQL DELETE mat karo. Active retries ke paths delete mat karo. Backups/data-retention policy business needs ke hisab se set karo.

## 8. Security advisor note

CrèmeCraft private `admins` aur `rate_limits` tables par RLS-without-policy info intentional hai: clients ke liye default-deny. Private role-check function apne authenticated UID ki membership hi return karta hai. Service-only rate RPC public/anon/authenticated se executable nahi hai.

Project mein pehle se existing `public.rls_auto_enable()` event-trigger function ke execute grants par advisor warnings mile. Is unrelated existing function ko preserve kiya hai. Owner review: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

Kisi future broad Storage RLS policy ko `cc-references` par public access nahi dena chahiye. Current inspected project mein aisi policy nahi thi.
