# Product — Brand System

This document defines the brand model in OPA: what a brand is, how it enters the platform, what it can do, how its public profile looks, and how OPA monetizes the relationship. It covers decisions made across DB, backend, frontend, and design.

---

## What a Brand Is in OPA

A brand is a fashion label (real or emerging) that publishes garments and outfits on OPA. Brands are distinct from regular users — they have a dedicated profile layout, a product catalog, and access to a management panel.

**Key principle:** brands are content creators first. They publish outfits (looks built from their own garments) that appear in the general feed. The catalog and purchase flow come second.

A brand IS a separate Supabase Auth account — it has its own email and password, independent from any personal user account. It is identified by `perfiles.is_brand = true`. Multiple employees can access the brand account by sharing its credentials, the same way a business Instagram account works.

A brand account cannot like, save, or follow — it only has access to brand management features (garment upload, outfit publishing, metrics, order management).

The `marcas` table links to the brand's own `perfiles` row via `profile_id` (renamed from `owner_id`).

---

## Brand Onboarding

The application is submitted from a personal user account. On approval, a separate brand account is created with the credentials the brand provided in the form.

### Step-by-step flow

1. A person logs into their personal OPA account
2. From **Settings → Registrar Marca**, they fill out a registration form that includes:
   - Brand name, category, Instagram handle
   - Email and password for the future brand account (chosen by the brand, not assigned by OPA)
3. Submitting the form creates a row in `brand_applications` with `status = 'pending'` — **no Supabase Auth account is created yet**
4. OPA reviews the application from the `opa-admin` panel
5. On **approval**: OPA calls `supabase.auth.admin.createUser()` with the email/password from the application, creates the `perfiles` row with `is_brand = true`, creates the `marcas` row, and sets `marcas.profile_id` to the new profile's id
6. On **rejection**: `brand_applications.status` is set to `rejected` with an optional `rejection_reason`; the applicant is notified

The brand then logs into OPA using the email and password they chose in the form. From that point, the brand account is completely independent from the personal account that submitted the application.

**The brand application flow (screen + backend) is not yet implemented.**

> **Demo shortcut (2026-07-13):** to have a working brand login before the onboarding backend exists, one brand account was created **by hand** in the DB, skipping the application flow. The existing **Revés** brand was reused (7 real prendas) rather than creating a new one: a Supabase Auth user was inserted directly into `auth.users` (bcrypt password via `extensions.crypt`, email confirmed), the `handle_new_user` trigger created `perfiles`, then `is_brand=true` was set and `marcas.profile_id` pointed at the new profile. Credentials (test): `reves@opa.com` / `reves1234`. This is exactly what step 5 above will automate via `supabase.auth.admin.createUser()` from `opa-admin` — the manual insert is a stopgap for demo/testing, not the real onboarding path.

---

## Brand Verification

Two levels — being approved to publish does not automatically grant the verified badge:

| Level | What it means | Badge |
|---|---|---|
| **Approved** | Can publish garments, outfits, and manage their panel | No badge |
| **Verified** | Additional step: CUIT/tax ID, active social media, minimum track record | ✅ Pink checkmark (`rosaOpa`) visible on profile and in outfit scroll |

The `marcas.verified` field in the DB corresponds to the verified level.

---

## Public Brand Profile

Designed from the Figma prototype. Differs significantly from a regular user profile.

### Header
- **Banner image** — full-width cover photo (brand campaign, lookbook, etc.); does not exist on user profiles
- **Circular logo avatar** — overlaps the bottom-left of the banner
- **Brand name** (bold, uppercase) + pink verified checkmark inline
- **`@handle · Marca`** — the `· Marca` label visually distinguishes it from a personal account
- **Bio** — short tagline (e.g. "Prendas oversized y washed con actitud street.")
- **Style tags** — chips (e.g. street, oversize, urban)

### Contextual "Ya lo tenés" Banner
- Appears only if the logged-in user has garments from this brand in `prendas_armario`
- Pink background strip: "Tenés **X prendas de MARCA** en tu armario" + arrow →
- Tapping it navigates to the wardrobe filtered by this brand
- Does not appear if user has no garments from this brand, or if not logged in

### Stats Row
Brands show different stats than users:

| Brands | Users |
|---|---|
| Seguidores | Seguidores |
| Outfits | Seguidos |
| Prendas | Outfits |
| — | Guardados |

Brands do not follow other accounts — no "Seguidos" stat.

### Follow Button
- Full-width pink button, same pattern as following a user
- Writes to `follows` table with `following_id = marca.profile_id` (current implementation) or a future `brand_follows` table

### Tabs
Two tabs, icon-only (no text labels):

| Tab | Icon | Content |
|---|---|---|
| Outfits | Grid (⊞) | 3-column grid of outfits published by this brand; tapping navigates to the outfit scroll |
| Catálogo | Shopping bag (🛍) | Grid of the brand's garments (`prendas`); tapping navigates to `product/[id]` |

The catalog tab is exclusive to brand profiles — regular users do not have it.

---

## What a Brand Can Do (Management Panel)

The panel is accessible to the brand owner from their profile.

> **2026-08-10: garment creation is now implemented — and it lives in `opa-mobile`, not `opa-web`.** Every earlier version of this doc (and of `CLAUDE.md`) assumed the brand management panel would be a separate desktop tool in the not-yet-started `opa-web` repo. The user explicitly asked to build "crear prenda" into the mobile app instead, in the Catálogo tab a brand already sees when logged in. This wasn't a reversal of the `opa-web` plan for everything — outfit publishing, metrics, and order management are still assumed to belong there — just garment upload specifically, because that's what got asked for and it fit naturally where the brand already manages its catalog. Full detail in `frontend-2026-06-06-screens-and-components.md` → "Create Garment".

| Feature | Description |
|---|---|
| Home / dashboard | ✅ **Implemented 2026-09-07** — logging in as a brand shows a completely different Home (`BrandHomeView`, not the consumer discovery feed): Tráfico de tu cuenta (likes/saves/followers real, visits/clicks still out — no tracking table), Preguntas sin responder (see "Answer buyer questions" below), Tus outfits publicados, Prendas en tendencia (ranked by real recent saves via `get_trending_garments`), Opiniones recientes (always the latest 3, no "see more" — by design). Full detail in `frontend-2026-06-06-screens-and-components.md` → "Brand Home". |
| Upload and edit garments | ✅ **Create implemented** (`app/brand/create-garment.tsx`, 2026-08-10) — name, description, price, category, images (real upload to Storage — up to 5 per garment since 2026-09-14, see `prenda_imagenes` in `database-2026-06-06-schema-and-seed.md`; the first is the cover), available sizes + stock per size, size guide (from existing OPA/brand guides only — see gap below). ✅ **"Delete" implemented as discontinue** (2026-08-14, see gap below for why not a real delete). ✅ **Edit implemented 2026-09-07** — same screen now doubles as editor via `app/brand/create-garment.tsx?id=<garmentId>`, prefills every field from the existing row and calls `PATCH /api/brands/me/prendas/:id` (new `api.updateGarment()`) instead of POST. Entry point: the product detail page (`app/product/[id].tsx`) shows an "Editar prenda" CTA instead of "Agregar al carrito" when the viewer is the owning brand — see "Brand can't shop their own catalog" row below. |
| Publish outfits | Build looks from their own garments; outfits appear in the general feed. **Still not implemented** — no outfit-creation screen exists yet anywhere in `opa-mobile` (checked 2026-09-07 while building the brand Home, which links "Tus outfits publicados" to the existing read-only Catálogo instead of a creation flow). Likely the largest remaining gap in the whole brand system. |
| Create custom size guides | Brand-specific `size_guides` rows linked to their `marcas.id`; override OPA default guides |
| Configure sale mode | Per-garment: sell directly through OPA or redirect to external URL (Tienda Nube, website, etc.) |
| Set external redirect URL | If sale mode = redirect, provide the URL per garment or per brand |
| View metrics | Likes, saves, profile visits, product clicks, conversion rate. ⚠️ **Partially implemented 2026-09-07** — likes/saves/followers are real (Home's "Tráfico de tu cuenta"); profile visits, product clicks and conversion rate still have no DB tracking at all. |
| Manage orders | View and update order status for direct sales; not applicable for redirect mode |
| Manage discounts | Strike-through price + discounted price; or promotional codes |
| Answer buyer questions | ✅ **Implemented 2026-09-07, reworked same day to a public Mercado Libre–style Q&A** — the first version had two entry points to ask (a specific garment, or the brand in general) and only the asker/brand could read a question. The user asked for it to work like Mercado Libre instead: **removed** the general "Preguntar" button next to "Seguir" on `app/marca/[id].tsx` (brand-level questions are no longer askable from the UI); **kept and expanded** the per-garment Q&A on `app/product/[id].tsx` into a public "PREGUNTAS Y RESPUESTAS" section — anyone visiting the listing (including logged-out visitors) can now read every question asked about that garment and its answer, not just their own (new RLS policy `public_select_garment_questions`, `garment_id IS NOT NULL`). The brand still manages/answers exclusively from their Home + `app/brand/questions.tsx` — no inline answer control was added to the public product page. This also closes the earlier gap ("asker can't see the answer") — the answer is now visible to everyone right on the product page, no separate notification needed. |
| Respond to reviews | Reply to user reviews on purchased garments — still not implemented (distinct from "Answer buyer questions" above, which is pre-purchase Q&A, not a reply to an existing `reseñas` row) |
| Upload brand content | Campaign photos and lookbooks visible in the "Las marcas que la gente elige" section on Home |
| Brand can't shop their own (or others') catalog | ✅ **Implemented 2026-09-07**, at the user's explicit request ("cuando abro una prenda no debería tener ni la opción de agregar al carrito ni de añadir a favoritos"). `app/product/[id].tsx` now branches on the viewer: normal consumer → unchanged (cart/save/CTA as before); brand viewing their **own** garment → no cart/save, "Editar prenda" CTA instead (see "Upload and edit garments" above); brand viewing **another** brand's garment → no cart/save, no CTA at all (editing someone else's product makes no sense, and buying/saving already wasn't allowed for brand accounts anywhere else in the app). The header's cart-icon shortcut to `/cart` is hidden for brand viewers too, for the same reason. |

---

## Sales Model

**Hybrid** — each brand chooses per garment whether to sell directly through OPA or redirect to an external URL.

| Mode | How it works | OPA's role |
|---|---|---|
| **Direct** | User completes the purchase inside OPA; OPA processes payment and transfers to the brand minus commission | Payment processor, order manager |
| **Redirect** | Tapping "Comprar" opens the brand's external URL (Tienda Nube, web, IG DM, etc.); OPA does not process payment | Discovery and referral only |

---

## Stock Management

For direct-sale garments, the brand manages stock per size inside OPA using the `stock_por_talle jsonb` column on `prendas` (e.g. `{"XS": 10, "S": 5, "M": 0}`).

- OPA decrements stock automatically when a direct sale is confirmed
- If a size reaches 0, it appears as unavailable in the size selector
- For redirect-mode garments, stock is managed by the external store; OPA shows all sizes as available unless the brand manually marks otherwise

---

## Monetization (OPA charges brands)

**Mixed model:**

| Revenue stream | Description |
|---|---|
| **Commission per direct sale** | OPA takes a % of each purchase processed inside the app; brands using redirect mode do not pay commission |
| **Monthly subscription** | Optional paid plan with additional benefits: higher feed visibility, advanced metrics, featured placement in "Las marcas que la gente elige", priority support |

Exact commission percentage and subscription tiers are not yet defined.

---

## Data Model Implications

Current DB supports brands partially. Gaps to fill:

- `marcas.verified` — field exists ✅
- `perfiles.is_brand` — field exists ✅
- `stock_por_talle jsonb` on `prendas` — field exists ✅
- `size_guides.brand_id` — field exists, RLS allows brand profile to insert ✅
- `brand_applications` table — exists ✅ (fields: `applicant_id`, `brand_name`, `instagram_handle`, `category`, `status`, `rejection_reason`, `reviewed_by`, `reviewed_at`)
- `sale_mode text` and `external_url text` on `prendas` — exist ✅
- `marcas.profile_id` — ✅ renamed from `owner_id` (migration `20260629000001_rename_marcas_owner_id_to_profile_id.sql` applied)
- Brand subscription / plan table — does not exist ❌
- Brand metrics aggregation — does not exist ❌
- `brand_points` for loyalty system — does not exist ❌ (see pending-features.md)

---

## Pending

### DB
- [x] Rename `marcas.owner_id` to `marcas.profile_id` — ✅ applied; RLS and API routes updated
- [x] Update RLS on `marcas` and `prendas` to use `profile_id` — ✅ applied
- [ ] Brand subscription / plan table — fields: `brand_id`, `plan_type`, `billing_cycle`, `status`, `started_at`

### Backend / API
- [ ] Brand application submission endpoint — `POST /api/brand-applications`; saves form data (brand name, IG handle, category, email, password hash or encrypted credential) to `brand_applications`; does NOT create Supabase Auth user yet
- [ ] Brand account creation on approval — called from `opa-admin` approve action; uses `supabase.auth.admin.createUser()` with stored credentials; creates `perfiles` row with `is_brand = true`; creates `marcas` row with `profile_id` = new profile id
- [ ] Gate brand management API routes by `perfiles.is_brand = true` in addition to auth check

### Frontend (opa-mobile)
- [ ] Settings → "Registrar Marca" button — visible only on personal accounts (`is_brand = false`)
- [ ] Brand registration form — fields: brand name, category, IG handle, email, password (for the future brand account); submits to `POST /api/brand-applications`
- [x] Multi-account switcher — ✅ implemented 2026-08-07 as "remembered accounts on this device" (no linked-account data model exists between a personal profile and a brand account, so a true Instagram-style switch wasn't possible as originally worded). See `meta-2026-06-10-pending-features.md` for full detail.
- [x] Brand profile screen — ✅ implemented (2026-07-06): `app/marca/[id].tsx`, standalone route (fuera del Tabs navigator, navbar calcada como en `app/user/[id].tsx`). Layout distinto al de usuario: banner + avatar-logo circular que lo pisa, nombre en mayúscula + badge `verificado_ondas.png` (solo si `marcas.verified`), `@handle · Marca`, bio, tags, stats **Seguidores / Outfits / Prendas** (sin "Seguidos"), botón Seguir full-width, y dos tabs icon-only (Grid `GridFinal` / Catálogo `bag`). Hook nuevo `useBrand(marcaId)` carga marca + prendas + (si hay `profile_id`) outfits y followers. Entry points enganchados: slider "Marcas" del home (`app/(tabs)/index.tsx`) y la fila de marca en `app/product/[id].tsx`. **Limitación real:** como todas las `marcas` (salvo Revés desde 2026-07-13) tienen `profile_id = null` (no existe onboarding de cuentas de marca todavía), la grilla de Outfits y el contador de Seguidores quedan vacíos y el botón Seguir es inerte para esas marcas — se activan solos cuando una marca tenga `profile_id`. El catálogo (prendas por `brand_id`) sí muestra datos reales.
- [x] Modo `isOwn` en el perfil de marca — ✅ implementado (2026-07-13) junto con el login de marca: cuando `brand.profile_id === session.user.id` (la marca ve su propio perfil), `app/marca/[id].tsx` muestra un engranaje de configuración (→ `/settings`, donde está el logout) en vez de compartir/menú, oculta el botón "Seguir", y marca "perfil" como activo en la navbar. Hook `useMyBrand.ts` (marca donde `profile_id = userId`) + `<Redirect>` en `app/(tabs)/profile.tsx` cuando `profile.is_brand`.
- [x] Catalog tab on brand profile — ✅ implemented (2026-07-06): grid 3-col de `prendas` filtradas por `brand_id`, tap → `product/[id]`. Parte de `app/marca/[id].tsx`.
- [x] "Ya lo tenés" banner logic — ✅ implemented (2026-07-06): en `app/marca/[id].tsx` cruza `useWardrobe(session.user.id)` con `garment.brand_id === marcaId`; muestra "Tenés X prendas de MARCA en tu armario" solo si el usuario logueado tiene prendas de esa marca. Tap navega a `/(tabs)/wardrobe` (el filtro del armario por marca todavía no existe — ver abajo).
- [ ] Wardrobe filtrado por marca — el banner "Ya lo tenés" hoy abre el armario sin filtro; falta que `app/(tabs)/wardrobe.tsx` acepte un param de marca y filtre
- [x] Garment creation screen — ✅ done 2026-08-10, `app/brand/create-garment.tsx`. See `frontend-2026-06-06-screens-and-components.md` for full detail.
- [x] Garment edit screen — ✅ done 2026-09-07, `app/brand/create-garment.tsx` in edit mode (`?id=`). See "Upload and edit garments" row above.
- [x] Garment delete — ✅ resolved 2026-08-14, but as a product decision, not a real DELETE: `prendas` has `ON DELETE CASCADE` from `outfit_items`/`prendas_armario`/`prendas_guardadas`, so a real delete would silently break any outfit (the brand's own or someone else's) that used the garment, plus `productos_orden`/`reseñas` are `ON DELETE NO ACTION` so it would outright fail if the garment had any order/review history. Instead, added `prendas.descontinuada` (boolean) — a brand can toggle "Descontinuar"/"Reactivar" from `app/(tabs)/wardrobe.tsx` (`BrandCatalogView`); a discontinued garment disappears from the public catalog (`marca/[id].tsx`, `search.tsx`, "más de esta marca" on `product/[id].tsx`) and purchase is blocked there ("Ya no disponible"), but it stays intact everywhere it's already referenced. Real delete is now support-only, done from `opa-admin` with `service_role`. **Implementation note:** writing `descontinuada` goes through a new owner-scoped RLS UPDATE policy on `prendas`, not through `PATCH /api/brands/me/prendas/:id` — that endpoint's field whitelist (in `opa-backend`, not cloned this session) doesn't include the new column. See `database-2026-06-06-schema-and-seed.md` and `meta-2026-06-10-pending-features.md` for the follow-up needed once `opa-backend` is accessible again.
- [ ] Brand custom size guide creation — **blocked on `opa-backend` access, not a mobile-side limitation.** `size_guides` RLS already lets a brand owner INSERT directly (`brand_id = auth.uid()`'s marca), but `size_guide_entries` (the actual per-size measurement rows) only allows `service_role` to INSERT — a brand can create the guide shell but not its measurements without going through a backend endpoint that doesn't exist yet. The 2026-08-10 create-garment form only lets brands pick from existing guides (10 OPA defaults + any brand-specific ones, none exist yet) for this reason — building a real "create your own guide" flow needs a new `opa-backend` endpoint (not buildable from an `opa-mobile`-only session; that repo isn't cloned here and there's no deploy access).
- [x] Brand Home / metrics dashboard — ✅ done 2026-09-07, `BrandHomeView` inside `app/(tabs)/index.tsx`. See "Home / dashboard" row above and `frontend-2026-06-06-screens-and-components.md`.
- [x] Buyer Q&A (ask a brand, brand answers) — ✅ done 2026-09-07. New `preguntas` table + `app/brand/questions.tsx` + entry points in `app/product/[id].tsx`/`app/marca/[id].tsx`. See "Answer buyer questions" row above.
- [x] Let the asker see the answer to their own question — ✅ resolved 2026-09-07 (same day, different session), by making the Q&A public instead of building a private notification: the product page's "PREGUNTAS Y RESPUESTAS" section shows every question and its answer to anyone, including the original asker, right where they asked it.
- [ ] Brand management panel screens — outfit publishing, order management still missing (metrics dashboard done, see above)
- [x] Size selector shows unavailable sizes greyed out based on `stock_por_talle` — ✅ done 2026-08-10 as part of the `app/product/[id].tsx` redesign (same session, see `CLAUDE.md`)

### opa-admin
- [ ] Brand application review screen — shows pending applications with all submitted fields including email; approve creates the account, reject sends reason

### Product / Business
- [ ] Two-level verification flow — OPA admin sets `marcas.verified = true` after additional review (CUIT, social media, track record)
- [ ] Brand follow system — decide if `follows` table is reused (`following_id = profile_id`) or a new `brand_follows` table is created
- [ ] Monetization: define commission % and subscription plan tiers
