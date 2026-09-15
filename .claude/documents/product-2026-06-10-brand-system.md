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

> **Note (2026-09-15):** this section used to duplicate `meta-2026-06-10-pending-features.md`, sometimes with more detail than the source of truth itself — the other 4 layer docs (frontend/backend/database/design) never did this, they only point here. All items that were still open have been migrated over (Database, Backend, Frontend, and Product Ideas sections); everything else listed here was already `[x]` and is documented in the sections above (Brand Onboarding, Public Brand Profile, What a Brand Can Do). Do not add new pending items here.
>
> All pending brand-system items are tracked in `meta-2026-06-10-pending-features.md`.
