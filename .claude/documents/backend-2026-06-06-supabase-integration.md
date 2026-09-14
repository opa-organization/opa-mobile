# Backend — Supabase Integration

This document covers the Supabase client setup, auth flow, data hooks, Zustand store, and TypeScript types used throughout the OPA app.

---

## Stack

- **Supabase JS SDK** (`@supabase/supabase-js`)
- **AsyncStorage** for session persistence in React Native
- **Zustand** for global client-side state

---

## Client Configuration

**`lib/supabase.ts`**
```ts
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
```

**`.env`** (not committed):
```
EXPO_PUBLIC_SUPABASE_URL=https://vecnktrbjolahcalkbml.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## Auth

### Initialization flow (`app/_layout.tsx`)
1. On mount, calls `supabase.auth.getSession()` to restore saved session
2. Calls `supabase.auth.onAuthStateChange()` to listen to real-time changes
3. If session exists, fetches profile from `perfiles`
4. Sets `initialized = true` when done (prevents incorrect UI flash)

### Login
```ts
const { error } = await supabase.auth.signInWithPassword({ email, password })
```

### Sign up
```ts
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      username: username.toLowerCase().replace(/\s/g, ''),
      display_name: displayName || username,
    },
  },
})
```

### Logout
```ts
await supabase.auth.signOut()
clear() // clears the Zustand store
```

### Delete account
Called from `app/settings.tsx`. Two-step flow:
1. Verify password: `supabase.auth.signInWithPassword({ email, password })`
2. Delete via RPC: `supabase.rpc('delete_user')`

The `delete_user()` function exists in Supabase (`SECURITY DEFINER`, migration `create_delete_user_function`) — see full SQL and deletion order in the "Delete Account" section below.

---

## Global State — Zustand (`store/useAuthStore.ts`)

```ts
interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  initialized: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  setInitialized: (initialized: boolean) => void
  clear: () => void
}
```

---

## Data Hooks

### `hooks/useOutfits.ts`
Fetches outfits with full joins:
```ts
supabase
  .from('outfits')
  .select(`
    *,
    creator:perfiles(*),
    garments:outfit_items(
      *,
      garment:prendas(*, brand:marcas(*))
    )
  `)
  .order('created_at', { ascending: false })
  .order('id', { ascending: false })
  .limit(PAGE_SIZE) // 10
```
**Paginación cursor-based (2026-08-10):** reemplaza el `LIMIT 20` fijo anterior. Cursor keyset sobre `(created_at, id)` — `id` es necesario como desempate porque varios outfits seed comparten el mismo `created_at` exacto (mismo INSERT); un cursor solo con `created_at` saltea o duplica filas en ese borde. Página siguiente: `.or('created_at.lt.X,and(created_at.eq.X,id.lt.Y)')` con `X`/`Y` = `created_at`/`id` de la última fila cargada. El hook devuelve `{ outfits, loading, loadingMore, hasMore, error, loadMore, refetch }`; `refetch()` resetea el cursor (reemplaza la lista, no la agranda). Conectado a `onEndReached` en los dos scrolls verticales tipo TikTok: `app/(tabs)/outfits.tsx` (feed principal) y `app/user-outfits.tsx` (outfits de un usuario). Los usos en grillas más chicas (`profile.tsx`, `user/[id].tsx`, carousel de `index.tsx`) siguen mostrando solo la primera página — no tienen `onEndReached` conectado, no era el caso de uso motivador del pendiente. Verificado en browser bajando `PAGE_SIZE` a 3 temporalmente: 3 páginas cargaron los 7 outfits seed sin duplicados ni saltos (confirmado contra el mismo query en SQL directo antes de tocar el hook).

### `hooks/useProfile.ts`
Fetches a profile by user ID from `perfiles`.

### `hooks/useWardrobe.ts`
Fetches the user's wardrobe items from `prendas_armario`.

### `hooks/useLike.ts`
Like toggle para outfits. El chequeo de estado inicial (¿ya di like?) sigue siendo un SELECT directo a `outfit_likes` — es lectura, RLS ya la permite pública, no gana nada pasando por la API. **El toggle en sí (2026-08-10) pasa por `lib/api.ts` → `POST/DELETE /api/outfits/:id/like`** en vez de escribir directo a Supabase — así el rate limiting y el bloqueo de cuentas de marca son reales (antes RLS no distinguía `is_brand`, cualquier cuenta autenticada podía insertar). `await`+`try/catch`: si la llamada falla (rate limit, red, cuenta de marca) el estado local no cambia. **Contador en vivo (2026-08-10):** se suscribe a `postgres_changes` (UPDATE, tabla `outfits`, `filter: id=eq.<outfitId>`) y toma `likes_count` directo de la fila confirmada en cada evento — no suma/resta a mano, así no hay drift, y el contador también se actualiza cuando el like es de **otro** usuario, no solo el propio. Requirió agregar `outfits` a la publicación `supabase_realtime` (no estaba — ninguna tabla lo estaba). Retorna `{ liked, count, toggle }`.

### `hooks/useSave.ts`
Save toggle para outfits. Mismo patrón que `useLike` en todo: lectura directa a Supabase para el estado inicial, toggle vía `lib/api.ts` → `/api/outfits/:id/save`, y contador en vivo por `postgres_changes` sobre `outfits.saves_count` (2026-08-10). Retorna `{ saved, count, toggle }`.

### `lib/api.ts` (nuevo, 2026-08-10)
Primer cliente HTTP de `opa-mobile` hacia la API Hono de `opa-backend` (`{EXPO_PUBLIC_SUPABASE_URL}/functions/v1/api`) — hasta esta fecha, `opa-mobile` nunca la había llamado, todo iba directo a Supabase vía RLS. Adjunta el `Authorization: Bearer <access_token>` de la sesión actual. Expone `api.likeOutfit/unlikeOutfit/saveOutfit/unsaveOutfit(outfitId)`; lanza `ApiError` (con `.status`) si la respuesta no es 2xx. **`api.getBrandMetrics()` (2026-09-07):** llama `GET /brands/me/metrics` (endpoint ya existía, nunca lo había llamado el mobile) — forma real confirmada en vivo antes de tipar la interfaz: `{ likes, saves, outfits_with_brand_garments, note }`.

### `hooks/useFollow.ts`
Follow toggle. INSERT en `follows`, DELETE para unfollow. Retorna `{ following, toggle }`.

### `hooks/useSavedOutfits.ts`
Outfits guardados en favoritos del usuario. Query con join completo a `outfits`, `perfiles`, `outfit_items`, `prendas`, `marcas`. Retorna `{ outfits, loading, refetch }`.

### `hooks/useSavedGarments.ts`
Prendas guardadas en favoritos del usuario desde `prendas_guardadas`. Retorna `{ garments, loading, refetch }`.

### `hooks/useSizeGuide.ts`
Fetches a size guide and its entries by `guideId`. Entries are ordered by `sort_order`. Retorna `{ guide, entries, loading }`. Si `guideId` es `undefined`, no hace fetch.

### `hooks/useUserMeasurements.ts`
Fetches the authenticated user's body measurements from `user_measurements`. Exposes `save(measurements)` que hace UPSERT. RLS estricto — solo puede leer y escribir la fila propia. Retorna `{ measurements, loading, save }`.

### `hooks/useRecommendedSize.ts`
Calls `supabase.rpc('get_recommended_size', { guide_id })` with the authenticated user's measurements. Returns the recommended `size_label` string or `null` if measurements are incomplete. Retorna `{ recommendedSize, loading }`.

### `hooks/useBrand.ts`
Fetches a `marcas` row by id + sus `prendas` (catálogo) + (si tiene `profile_id`) outfits y followers count. Usado en `app/marca/[id].tsx`.

### `hooks/useMyBrand.ts`
Fetches la `marcas` row donde `profile_id = session.user.id` — la marca del usuario de marca autenticado. Usado en `app/(tabs)/profile.tsx` para el redirect a `/marca/[id]` y en el modo `isOwn` de `app/marca/[id].tsx`.

### `hooks/useBrandMetrics.ts` (nuevo, 2026-09-07)
Métricas reales para la Home de marca. `likes`/`saves` vienen de `api.getBrandMetrics()` (endpoint ya existente, primera vez que `opa-mobile` lo llama); `followers` es un `count` directo sobre `follows` (mismo query que ya usa `useBrand.ts`). Visitas/clics no se piden — no hay tracking de eso en la DB todavía (ver `lib/api.ts` → `BrandMetrics.note`). Retorna `{ likes, saves, followers, loading }`.

### `hooks/useTrendingGarments.ts` (nuevo, 2026-09-07)
Llama a `supabase.rpc('get_trending_garments', { p_brand_id, p_days, p_limit })` — catálogo de la marca ordenado por guardados recientes (default 7 días). Ver `database-2026-06-06-schema-and-seed.md` para la función SQL. Retorna `{ garments, loading }`, cada `garment` trae además `recent_saves: number`.

### `hooks/useBrandQuestions.ts` (nuevo, 2026-09-07)
Preguntas SIN responder de una marca (tabla `preguntas`). Acepta `{ limit }` opcional — la Home pide `limit: 3`, `app/brand/questions.tsx` pide todas. Devuelve también `totalCount` (conteo real, independiente del `limit`, para el badge) y `answer(questionId, texto)` que hace el UPDATE y saca la pregunta de la lista local al confirmar. Retorna `{ questions, totalCount, loading, refetch, answer }`.

### `hooks/useAskQuestion.ts` (nuevo, 2026-09-07)
Insertar una pregunta en `preguntas` — `ask(brandId, question, garmentId?)`. `garmentId` omitido = pregunta general sobre la marca. Mismo patrón `requiresAuth` que `useSaveGarment`/`useFollow`. No bloquea cuentas de marca a nivel de hook (el caller oculta el botón si `viewerIsBrand`, mismo criterio no reforzado server-side que otras acciones antes de `routes/social.ts`).

### `hooks/useBrandReviews.ts` (nuevo, 2026-09-07)
Últimas reseñas de TODAS las prendas de una marca (a diferencia de `useGarmentReviews`, que es por una sola prenda). Recibe un array de `garment_id` ya resueltos (los trae `useBrand`) porque `reseñas` no tiene `brand_id` propio. Retorna `{ reviews, loading }`.

### `hooks/useNotifications.ts` (nuevo, 2026-09-14)
Centro de notificaciones — tabla `notificaciones`, alimentada 100% por triggers de DB (ver `database-2026-06-06-schema-and-seed.md`), este hook solo lee y marca como leída, nunca inserta. Usado tanto por la campanita (`NotificationBell` en `app/(tabs)/index.tsx`, solo necesita `unreadCount`) como por `app/notifications.tsx` (necesita la lista completa) — mismo hook para los dos, el volumen de datos es chico. Trae los últimos 100 registros con `actor`/`outfit`/`garment` embebidos (`select` con joins de Postgrest — `actor` usa `perfiles!notificaciones_actor_id_fkey` explícito porque hay dos FKs de `notificaciones` a `perfiles`, recipient y actor, y Postgrest necesita el nombre del constraint para no ambigüar cuál usar). Se suscribe a `postgres_changes` (evento `*`, filtrado por `recipient_id`) sobre `notificaciones` — mismo patrón realtime que `useLike`/`useSave` — así la campanita cambia de color y la lista se actualiza sola sin refetch manual cuando llega o se marca algo. Retorna `{ notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch }`.

**Bug real encontrado y arreglado durante esta sesión — "cannot add `postgres_changes` callbacks... after `subscribe()`":** apareció durante el flujo real de signup (crear cuenta nueva y aterrizar en Home), no en un re-render normal — la hipótesis más consistente con la evidencia es que la transición de navegación justo después del signup (mientras el router todavía resuelve a qué pantalla ir) deja `NotificationBell` montarse/desmontarse rápido, y una segunda invocación del efecto de suscripción pisó un canal Supabase Realtime que ya tenía `.subscribe()` llamado (el topic `notificaciones-<userId>` quedó reusado desde el cliente de Supabase antes de que la limpieza async del primer canal terminara). **Fix defensivo** en el propio hook: antes de crear el canal, busca en `supabase.getChannels()` uno con el mismo topic (`realtime:notificaciones-<userId>`) y lo remueve primero si existe — así una segunda invocación nunca intenta `.on()` sobre un canal ya suscripto. No se pudo aislar el trigger exacto de React/Router detrás del doble-montaje (no hay `StrictMode` en el proyecto), pero el fix es correcto para cualquier causa de este tipo (protege contra el síntoma, no contra una causa puntual). Verificado: el mismo flujo (signup → Home) ya no crashea después del fix.

---

## TypeScript Types (`types/index.ts`)

Types are aligned to the real Spanish-named schema. Core entities (see the file itself for the full list, including `WardrobeItem`, `Follow`, `SavedOutfit`, `CartItem`, `Order`/`OrderItem`, `Review`, `Question` (2026-09-07 — tabla `preguntas`), `AppNotification` (2026-09-14 — tabla `notificaciones`; se llama `AppNotification` y no `Notification` para no colisionar con el tipo global `Notification` del DOM, relevante en el target web), and the size-guide types):

```ts
export interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  instagram_handle: string | null
  tags: string[]
  followers_count: number
  following_count: number
  outfits_count: number
  is_brand: boolean
  created_at: string
}

export interface Brand {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  profile_id: string | null
  instagram_handle: string | null
  website: string | null
  location: string | null
  tags: string[]
  verified: boolean
  created_at: string
}

export interface Garment {
  id: string
  brand_id: string
  name: string
  description: string | null
  price: number
  category: string | null
  style: string | null
  image_url: string | null
  color: string | null
  available_sizes: string[]
  size_guide_id: string | null
  sale_mode: 'direct' | 'redirect'
  external_url: string | null
  stock_por_talle: Record<string, number> | null   // agregado 2026-08-07; columna ya existía en la DB, faltaba en el tipo
  created_at: string
  brand?: Brand
}

// outfit_items — links outfits to garments by slot (no position coordinates)
export interface OutfitItem {
  id: string
  outfit_id: string
  garment_id: string
  slot: string | null  // torso | piernas | calzado | extras
}

export interface OutfitItemWithData extends OutfitItem {
  garment: Garment
}

export interface Outfit {
  id: string
  creator_id: string | null
  title: string | null
  description: string | null
  cover_image_url: string | null
  occasion: string | null
  style: string | null
  likes_count: number
  saves_count: number
  created_at: string
  creator?: Profile
  garments?: OutfitItemWithData[]
}
```

---

## Delete Account

Triggered from `app/settings.tsx`. The screen verifies the password with `signInWithPassword` first, then calls:

```ts
await supabase.rpc('delete_user')
```

### SQL function `delete_user()` (applied — migration `create_delete_user_function`)

```sql
create or replace function delete_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  update marcas set profile_id = null where profile_id = uid;

  delete from productos_orden
    where order_id in (select id from orders where user_id = uid);
  delete from reseñas where user_id = uid;
  delete from orders where user_id = uid;

  delete from outfits where creator_id = uid;

  delete from perfiles where id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function delete_user() from public;
grant execute on function delete_user() to authenticated;
```

**Orden de borrado y por qué:**

| Paso | Tabla | Motivo |
|---|---|---|
| 1 | `marcas.profile_id` → NULL | FK NO ACTION; no se borra la marca |
| 2 | `productos_orden` | FK NO ACTION → `orders` |
| 3 | `reseñas` | FK NO ACTION → `perfiles` |
| 4 | `orders` | FK NO ACTION → `perfiles` |
| 5 | `outfits` | FK NO ACTION → `perfiles`; `outfit_items`, `outfit_likes`, `outfits_guardados` tienen CASCADE desde `outfits` |
| 6 | `perfiles` | `follows`, `outfit_likes`, `outfits_guardados`, `prendas_armario`, `productos_carrito` tienen CASCADE desde `perfiles` |
| 7 | `auth.users` | `sessions`, `identities`, etc. tienen CASCADE desde `auth.users` |

---

## Pending

> All pending backend items are tracked in `meta-2026-06-10-pending-features.md`. Do not add new pending items here.
