# Flat Reality SDK Dashboard — AnyChannel alpha

The first dashboard MVP: account + organization, transmission CRUD, FR Channel-style Editor.js story, cover and inline image uploads, scheduled/draft status, usage card and a responsive/collapsible workspace UI. It intentionally has **no categories, delivery channels, game bindings, widget or billing integration** yet. Those belong to the next phase. The existing `flatreality.eu` FR Channel is not modified or migrated.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Without environment variables the app runs in a clearly marked local demo mode. Demo transmissions are saved in the current browser's localStorage, and no account is created. This is only for visual/UI testing.

## Free cloud alpha setup

1. Create a **new** Supabase Free project; do not use the existing FR Channel project. The Free tier currently includes 500 MB database, 1 GB file storage and 5 GB egress. This is appropriate for an alpha, not a production uptime promise.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor. Confirm all three `anychannel_*` tables have RLS enabled and the `anychannel-media` bucket exists.
3. In Authentication → URL Configuration, set `https://dev.partners.flatreality.eu` as Site URL and add `http://localhost:5173/**` and the production URL to redirect allowlist. Keep email confirmation enabled.
4. Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is safe in the browser; **never** put `service_role`, secret keys or storage S3 credentials in Vite variables.
5. In the GitHub repository settings, add the same two values as Actions **variables**, select GitHub Actions as Pages source, and set the custom domain to `dev.partners.flatreality.eu`. Point its DNS CNAME at `flat-reality.github.io` (confirm the correct GitHub Pages hostname in repository settings). `public/CNAME` is copied into the build.

Supabase Storage standard uploads are used for MVP media. This keeps starting cost at €0 without requiring Cloudflare R2 billing setup. A file is max 6 MB; originals are served via Supabase's public Storage URL. The 1 GB meter is an alpha dashboard estimate based on recorded uploads, not an authoritative paid-plan entitlement; production quota enforcement must move server-side before charging customers. A private draft's media URL is public to anyone who has the unguessable URL, so do not upload confidential material in this alpha.

## Architecture / next phase

The dashboard is static and GitHub Pages-compatible. Supabase Auth issues user sessions. RLS isolates `anychannel_profiles`, `anychannel_transmissions` and `anychannel_media` per user. The Bender font files under `public/assets/fonts` are loaded locally. The FR Channel Editor.js block set is preserved for future migration, but **custom HTML must never be rendered publicly without sanitization**.

The next phase defines user-created channels, public delivery API, immutable snapshots and game/widget integrations. Neither FR's internal categories nor FR's special routes should become global customer defaults. Media can later move behind R2/CDN via a storage adapter without changing transmission records, but this alpha does not require R2.

Billing is intentionally nonfunctional; `€9/month` is labeled as planned pricing. No checkout or payment data is collected. The published/scheduled status in this alpha is editorial metadata; it is **not yet a public delivery guarantee**.
