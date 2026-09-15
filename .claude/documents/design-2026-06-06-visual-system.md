# Design — Visual System

This document covers OPA's visual design system: color palette, typography, spacing, key UI components, Storage resources, and design principles.

---

## Concept

OPA is a fashion discovery app. The visual experience comes first: immersive, aspirational, and fluid. It feels closer to TikTok/Pinterest than a traditional online store.

**Three pillars:**
1. Outfit discovery
2. Smart personal wardrobe
3. Contextual shopping (completing a look)

---

## Color Palette

| Token | Value | Usage |
|---|---|---|
| `rosaOpa` | `#EB006B` | Primary color: buttons, accents, prices, active indicators |
| `rosaOpaLight` | `rgba(235, 0, 107, 0.2)` | Active tab background in navbar |
| `negro` | `#000000` | Main text, brand card borders |
| `blanco` | `#FFFFFF` | Backgrounds, text on dark backgrounds |
| `grisClaro` | `#838383` | Secondary text, placeholders |
| `grisBorde` | `#F2F2F2` | Borders, secondary backgrounds |
| `grisMedio` | `#D9D9D9` | Skeletons, image placeholders |
| `grisOscuro` | `#4E4E4E` | Tertiary text |
| `bordeTag` | `#A6A6AC` | Style chip borders |

---

## Typography

| Font | Usage |
|---|---|
| **Merge One** (serif) | Section titles, OPA logo as text, headings |
| **Palanquin Dark** (sans) | Buttons, usernames, UI text |
| System default | Prices, short descriptions |

**Font loading:**
- `MergeOne-Regular.ttf` → `assets/fonts/MergeOne-Regular.ttf`
- `PalanquinDark` → via `@expo-google-fonts/palanquin-dark`
- Loaded with `useFonts` in `app/_layout.tsx`

---

## Spacing and Radius

```
Spacing: xs=4, sm=8, md=12, lg=16, xl=24, xxl=32
Radius:  card=15, chip=10, button=8, tag=8, avatar=9999
```

---

## Key Design Components

### Bottom Nav Bar (`BottomNavBar`)

> Component: `components/navigation/BottomNavBar.tsx`  
> Registered in `app/(tabs)/_layout.tsx`

**Container:**
- `flexDirection: row`, `backgroundColor: blanco`
- `borderTopWidth: 1`, `borderTopColor: grisBorde` — thin gray separator
- `paddingBottom`: `useSafeAreaInsets().bottom` (not hardcoded)
- `paddingTop: 8`, `paddingHorizontal: 4`

**5 flat equal tabs — no elevated center button:**
- Each tab: `flex: 1`, `alignItems: center`, `justifyContent: center`

**Tab inactive:**
- No background
- Icon: default version (`home.png`, `outfit.png`, etc.) from `assets/nav/`
- Icon size: `28×28px`

**Tab active:**
- Icon container: `48×48px`, `borderRadius: 8`, `backgroundColor: rosaOpaLight`
- Icon: `_rosa.png` variant from `assets/nav/`
- Icon size: `28×28px`
- Use `expo-image` (`Image` from `expo-image`) with `contentFit="contain"`

### Outfit Cards
- **Home carousel**: 220×370px, radius 15, `negro` shadow 8px
- **Vertical feed**: full-screen (100vw × 100vh)
- **Profile grid**: 130×231px (9:16 ratio)
- **Outfits tab card**: 200×356px

### Garment Cards
- Home: 120×150px, radius 15, name + pink price
- Wardrobe: pending

### Brand Cards
- Home: 110×110px square, 1.5px black border, radius 15
- Shows logo if available, uppercase name otherwise

### Floating Labels in Outfit Scroll

**Chip:**
- Background `blanco`, `borderRadius: chip (10)`, `padding: 6`
- Thumbnail: `32×32px`, `borderRadius: 6` — rounded square (NOT circular)
- Name: `fontSize: 11`, `fontFamily: mergeOne`, `color: negro`
- Price: `fontSize: 11`, `fontFamily: mergeOne`, `color: rosaOpa`
- Shadow: `shadowColor: negro, offset: {0,2}, opacity: 0.15, radius: 4, elevation: 4`
- `maxWidth: 160`

**Visual connector (línea en codo + punto), implementación real:**
- No hay coordenadas `position_x/position_y` en la DB (`outfit_items` usa `slot` categórico) — el ancla de cada prenda se deriva de su `slot` vía una tabla `SLOT_ANCHOR` (extras/torso/piernas/calzado → fracción x/y sobre la figura)
- Los chips se ordenan por slot y se separan verticalmente con anti-solapamiento (`lastBottom`) para no pisarse
- Línea: segmento horizontal + diagonal (`View`s rotados con `transformOrigin`), terminando en un punto blanco (`connDot`) sobre el ancla
- Es una aproximación **por slot**, no pixel-perfect por prenda — si se necesita precisión real habría que agregar `position_x/position_y numeric` a `outfit_items` (ver pending-features.md). **Decidido 2026-08-07:** ese x/y no se va a completar a mano por nosotros para los outfits seed — lo va a cargar la marca de forma visual al crear/editar una prenda (un paso de "ubicá esta prenda sobre la foto"), probablemente en `opa-web`. Cuando eso exista, el render acá tiene que consumir coordenadas reales si están presentes y caer al ancla por `slot` si no (para no romper prendas/outfits viejos sin coordenadas)

**Behavior:**
- Always visible on the active item (no tap required — tap-to-reveal applies to the future detail screen)

---

### Outfit Scroll Floating Header

- Position: `absolute, top: 0, left: 0, right: 0, zIndex: 10`
- Background: transparent (no `backgroundColor`)
- Layout: row with `justifyContent: space-between`, `paddingHorizontal: 16`, `paddingVertical: 12`

**Truck icon (left):**
- PNG image from Supabase Storage: `assets/camion_blanco.png`
- Size: `24×24px`, `tintColor: blanco`
- Do NOT use 🚚 emoji

**Center tabs ("tus marcas / Descubrir"):**
- Container: transparent — texto plano sobre la foto, SIN pill oscuro (se removió `rgba(0,0,0,0.4)` el 2026-07-06 para matchear el prototipo)
- Inactive tab: `color: rgba(255,255,255,0.6)`, `fontSize: 13`, `fontWeight: 500`
- Active tab: `color: blanco`, `fontWeight: 700`, `2px` `rosaOpa` underline (implementado como `View` de 2px bajo el texto activo)
- **No separator between tabs** (removed 2026-07-06 to match the prototype — a previous version of this section still showed `Separator "/"`, kept for a "/" that no longer exists in the code)

**"+" button (right):**
- Just the glyph, no circle/border (circle removed 2026-07-06 to match the prototype — a previous version of this section still described a `32×32px` bordered circle)
- Text "+": `color: blanco`, `fontSize: 28`, `fontWeight: 300`

---

### Action Buttons (Outfit Scroll)

- Vertical column, `position: absolute, right: 16`, ~`top: 40%` (no centrado en toda la pantalla)
- `gap: 20` between buttons
- **NO numeric counters visible by default**
- **NO "Compartir" text** — icon only
- **Sin círculo blanco de fondo** (se quitó el 2026-07-13 — antes tenían fondo blanco 44px, ahora son iconos directamente sobre la foto)

**Each button:**
- Touch target `44×44px` (raised from `34×34` on 2026-09-15 — audit `meta-2026-09-14-code-audit.md` B8, below the recommended accessibility minimum)
- Glyph blanco (`♥/♡`, `★/☆`, `fontSize: 32`) o `compartir.png` con `tintColor: blanco`, `28×28px` — sized proportionally to the larger touch target, not 1:1 with it
- No background, no border — `textShadow`/shadow sutil para legibilidad sobre la foto
- On activation (like/save): outline → filled transition, spring animation `damping: 10, stiffness: 200`

**Icons:**
- Like: heart outline → filled (`rosaOpa` when active)
- Save: star outline → filled (blanco when active)
- Share: `compartir.png` con `tintColor: blanco` — no toggle state

---

### Brand Info (Outfit Scroll)

> **Nota:** hoy este bloque muestra al **creador** (usuario), no a la marca — las `marcas` no tienen outfits propios todavía (falta onboarding de cuentas de marca con publicación de looks). El diseño de abajo aplica igual a ambos casos.

- Position: `absolute, bottom: [bottom bar height + 16], left: 16`, `right: 80` (to avoid overlapping buttons)

**Brand avatar:**
- `40×40px`, `borderRadius: 9999` (circular)
- Shows `logo_url` from Supabase Storage (`avatars/brands/`)
- Fallback if no logo: black circle with white initial, `fontSize: 16, fontWeight: 700`

**Brand name:**
- `color: blanco`, `fontWeight: 700`, `fontSize: 14`, UPPERCASE
- Verified checkmark (✓ or `rosaOpa` checkmark icon, `fontSize: 12`) inline if `brand.verified === true`

**Outfit title:**
- `color: rgba(255,255,255,0.85)`, `fontSize: 12`, `marginTop: 2`

---

### Outfit Bottom Bar

- Position: `absolute, bottom: 0, left: 0, right: 0`
- `backgroundColor: blanco`
- `borderTopLeftRadius: 15, borderTopRightRadius: 15`
- `paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30` (30 for home indicator clearance)
- Shadow: `shadowColor: negro, offset: {0,-2}, opacity: 0.08, radius: 8, elevation: 10`
- Layout: row `alignItems: center, justifyContent: space-between`

**Left section (bag + price):**
- Bag icon: container `backgroundColor: rosaOpaLight`, `borderRadius: 8`, `padding: 8`, pink bag icon `20×20px`
- Column next to it: label "Precio total" (`fontSize: 11, color: grisClaro, uppercase, letterSpacing: 0.5`) + price (`fontSize: 20, fontWeight: 800, fontFamily: mergeOne, color: negro`)

**Discount badge (center, only if `discount_percent > 0`):**
- Circle `backgroundColor: rosaOpa`, `borderRadius: 9999`, `padding: 8`
- White "%" symbol on top (`fontSize: 14, fontWeight: 700`)
- Below: "X% OFF" (`fontSize: 10, color: negro, fontWeight: 600`) + "Ahorras $Y" (`fontSize: 10, color: grisOscuro`)
- Do not render if no discount

**"Ver outfit" button (right):**
- `backgroundColor: rosaOpa`, `borderRadius: button (8)`
- `paddingHorizontal: 20, paddingVertical: 12`
- Text: "Ver outfit", `color: blanco, fontWeight: 700, fontSize: 14, fontFamily: palanquinDark`

---

## Resources in Supabase Storage

### Bucket `assets` (public)
```
assets/
  logoOPA-transparente.png   # Logo for home header (transparent background)
  logoOPA-blanco.png         # White logo for dark backgrounds
  camion_blanco.png          # Delivery icon
  flecha.png                 # Back arrow (apunta a la izquierda)
  compartir.png              # Share icon
  bag_rosa.png                # Bolsa rosa (precio en outfit scroll, marca/[id])
  verificado_ondas.png       # Verified badge (marca/[id])
  Grid.png / Grid_rosa.png                 # Profile grid tab
  estrella_gris.png / estrella_negra.png   # Favoritos tab
  percha_negra.png           # Prendas guardadas sub-tab
  caja_negra.png / caja_rosa.png           # Pedidos tab
  nav/
    home.png / home_rosa.png
    outfit.png / outfit_rosa.png
    search.png / search_rosa.png
    armario.png / armario_rosa.png
    user.png / user_rosa.png
    outfit_v2.png             # Outfits guardados sub-tab
```

> Nombres de archivo case-sensitive. Antes de usar texto/emoji como placeholder para un ícono, chequear si ya existe en este bucket (`fetch(BASE + 'nombre.png', {method:'HEAD'})` desde el preview del browser).

### Bucket `avatars` (public)
```
avatars/
  brands/
    midway_avatar.png    # real
    doblev_avatar.png    # real
    batuk_avatar.jfif    # real
    forma_avatar.png     # ficción
    reves_avatar.png     # ficción
    capas_avatar.png     # ficción
    sole_avatar.png      # ficción
```

**Base URL:** `https://vecnktrbjolahcalkbml.supabase.co/storage/v1/object/public/`

---

## Design Principles

- **Content first**: the image is always the most important element; UI is secondary
- **No overloading**: progressive information disclosure, reveal on interaction
- **Tap to reveal**: in the outfit scroll, info appears on tap
- **No friction**: the inspiration → purchase path must be as short as possible
- **Aspirational**: the app should feel like a curated fashion feed, not a catalog

---

## Pending

> All pending design items are tracked in `meta-2026-06-10-pending-features.md`. Do not add new pending items here.
