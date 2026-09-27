# Verification report — 27 September 2026

## Passed against existing Supabase project

- Fresh order enquiry saved; database confirmed `pending` even when client sent `completed`.
- Exact retry returned original receipt without another order; changed payload with same request key returned 409.
- Optional PNG uploaded to private `cc-references` bucket and linked to saved order.
- Fake PNG/SVG payload and >5 MB file rejected.
- Contact message saved; malformed email rejected.
- Anonymous REST reads of orders/messages denied; direct anonymous inserts denied.
- Anonymous Storage listing empty/denied, actual private image public/authenticated URL downloads denied, direct visitor upload denied.
- Service-only rate-limit RPC denied to visitors.
- Sixth new submission for same email in current hour returned 429.

## Passed database transaction tests

`tests/access.sql` used temporary admin and ordinary-user fixtures, all rolled back:

- Initial status enforced as pending.
- Anonymous data access denied.
- Ordinary authenticated user sees no orders/messages/reference metadata and cannot update orders.
- User-controlled `admin` metadata does not grant admin access.
- Self-promotion into admin allowlist denied.
- Authorized admin can read orders and update status.
- Admin cannot modify customer name; invalid status rejected.
- Admin access revocation takes effect on next database request.

## Passed local tests

`node --test tests/validation.test.mjs`: 4 tests passed (multiple validation cases inside each).
JavaScript syntax checks passed for storefront, backend helper, admin and live test script.
Original image asset bytes are unchanged; original stylesheet preserved with appended form-state styles.

## Not fully verified here

Automated rendered-browser testing could not run: no Chromium executable was installed and the browser download failed in this execution environment. Real email/password admin login, rendered responsive UI, private image viewing through the admin page and visual animation behavior still need browser verification after creating the first real admin. Backend permissions and live HTTP submission/upload behavior were verified separately as above. No claim of a completed visual regression test is made.

## Account configuration still needed

1. Create real email/password Auth user and authorize their UUID in `cc_private.admins`.
2. Publish extracted site files to your desired HTTPS static host.
3. Set `CC_ALLOWED_ORIGINS` to final host origin (recommended).
4. Review retained labelled QA data and remove it using the precise guide steps when done.

## Deployment notes

Migration `20260927115108_cremecraft_secure_backend` and Edge Function `cc-submit` deployed successfully. Private bucket has 5 MB limit and JPG/PNG/WebP MIME allowlist. No customer data existed in public tables during initial inspection, and existing system data/functions were preserved.

Security advisor reports intentional RLS-with-no-policy info for private deny-all tables. Existing unrelated `public.rls_auto_enable()` event-trigger grants generated two warnings, documented for owner review in the setup guide; that function was preserved.
