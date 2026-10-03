# Flat Reality SDK Dashboard — AnyChannel alpha

The AnyChannel dashboard MVP: account + organization, transmission CRUD, FR Channel-style Editor.js story, user-created delivery apps, App IDs, app assignments, cover/inline image uploads, scheduling and a responsive workspace UI. FR's internal categories are deliberately not copied into customer workspaces.

Primary URL (when the domain returns): <https://dev.flatreality.eu/>.

Current/fallback GitHub Pages URL: <https://flat-reality.github.io/FRSDK_Webapp/>.

All dashboard redirects are origin-relative, and integration documentation records both URLs. Do not hard-code only one dashboard host.

> **Supabase location:** this app uses the `AnyChannel Cloud Alpha` project (`ecuslqjmsapmswaklpqa`) inside the **Flat Reality Cluster 2** organization. It does not use the original Flat Reality organization, `FRWorkspace`, or the existing `FR Channel` project. Keep future AnyChannel migrations in Cluster 2 unless the architecture is deliberately changed.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Without environment variables the app runs in a clearly marked local demo mode. Demo transmissions are saved in the current browser's localStorage, and no account is created. This is only for visual/UI testing.

## Free cloud alpha setup

1. The **Flat Reality Cluster 2 → AnyChannel Cloud Alpha** Supabase Free project is the alpha backend. Do not use the existing FR Channel project. The Free tier is appropriate for an alpha, not a production uptime promise.
2. The versioned `initialize_anychannel_alpha` and `index_anychannel_media_owner` migrations are already applied. [`supabase/schema.sql`](supabase/schema.sql) remains the readable schema reference. Confirm all three `anychannel_*` tables have RLS enabled and the `anychannel-media` bucket exists before applying future changes.
3. Auth redirects must allow both `https://dev.flatreality.eu/**` and `https://flat-reality.github.io/FRSDK_Webapp/**`, plus `http://localhost:5173/**` for development. Keep email confirmation enabled.
4. Copy `.env.example` to `.env.local` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. The publishable key is safe in the browser; **never** put `service_role`, secret keys or storage S3 credentials in Vite variables.
5. GitHub Pages currently deploys from `main` at `https://flat-reality.github.io/FRSDK_Webapp/`. When DNS is restored, add the CNAME for `dev.flatreality.eu` without removing the classic GitHub Pages fallback from documentation or Auth allowlists.

Supabase Storage standard uploads are used for MVP media. This keeps starting cost at €0 without requiring Cloudflare R2 billing setup. A file is max 6 MB; originals are served via Supabase's public Storage URL. The 1 GB meter is an alpha dashboard estimate based on recorded uploads, not an authoritative paid-plan entitlement; production quota enforcement must move server-side before charging customers. A private draft's media URL is public to anyone who has the unguessable URL, so do not upload confidential material in this alpha.

## Architecture / next phase

The dashboard is static and GitHub Pages-compatible. Supabase Auth issues user sessions. RLS isolates `anychannel_profiles`, `anychannel_transmissions` and `anychannel_media` per user. The Bender font files under `public/assets/fonts` are loaded locally. The FR Channel Editor.js block set is preserved for future migration, but **custom HTML must never be rendered publicly without sanitization**.

`anychannel_apps` stores user-created destinations and opaque public App IDs; `anychannel_transmission_apps` stores delivery assignments. Neither FR's internal categories nor FR's special routes become customer defaults. The Unity technical package lives beside this repository at `FRSDK_Channel`; a downloadable snapshot is published from `public/downloads/com.flatreality.channel.zip`.

Billing is intentionally nonfunctional; `€9/month` is labeled as planned pricing. No checkout or payment data is collected. The published/scheduled status in this alpha is editorial metadata; it is **not yet a public delivery guarantee**.

## Planned integrations — do not implement yet

### `flatreality.eu/admin` migration

- Inventory the existing FR Channel posts, media, block payloads, publication dates and internal categories.
- Map posts to the shared transmission schema without turning FR-only categories into global SaaS defaults.
- Create a dedicated Flat Reality workspace and FR-owned apps, then run an idempotent migration with a dry-run report.
- Preserve legacy URLs through redirects or aliases and compare migrated output against the current website before cutover.
- Remove the old admin only after the shared dashboard powers both the website and a real Unity integration.

### Callao Workspace integration

- Treat Callao as the future organization/account authority, not as a second content database.
- Define organization IDs, verified-organization status, membership/roles and SSO/session handoff.
- Keep AnyChannel content ownership keyed to a stable workspace ID so current single-owner rows can be migrated safely.
- Add invitations and permissions only after the identity contract, token validation and RLS model are reviewed together.
- Until that milestone, do not couple Supabase authorization to editable user metadata or assume a Callao session exists.
