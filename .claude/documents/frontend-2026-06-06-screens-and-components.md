# Frontend — Screens and Components

This document covers all implemented screens, components, design tokens, and relevant technical configuration for the OPA app.

---

## Stack

- React Native + Expo SDK 54 (managed workflow)
- Expo Router v6 (file-based routing)
- NativeWind installed (but `StyleSheet` is used primarily)
- Expo Image (`expo-image`) for images with caching
- React Native Reanimated for animations
- Zustand for global state

---

## Route Structure

```
app/
  _layout.tsx          # Root layout: fonts, auth init, Stack navigator
  (tabs)/
    _layout.tsx        # Tab layout with custom BottomNavBar
    index.tsx          # Home
    outfits.tsx        # Outfit Scroll (TikTok-style)
    search.tsx         # Search funcional
    wardrobe.tsx       # Armario personal con datos reales
    profile.tsx        # Profile
  auth/
    index.tsx          # Login/Signup con validación por campo
  settings.tsx         # Settings screen
  user-outfits.tsx     # Scroll de outfits de un usuario específico
  saved-outfits.tsx    # Scroll de outfits guardados en favoritos
  measurements.tsx     # Mis medidas — inputs numéricos de medidas corporales
  product/
    [id].tsx           # Detalle de prenda con SizeGuideSheet
  outfit/
    [id].tsx           # Detalle de outfit con prendas por slot
  user/
    [id].tsx           # Perfil de otro usuario (no el propio) — solo lectura + follow
  marca/
    [id].tsx           # Perfil público de marca (banner + catálogo); modo isOwn para la propia marca logueada
  brand/
    create-garment.tsx # Cargar prenda nueva (cuentas de marca)
    questions.tsx      # Todas las preguntas sin responder + flujo de contestar (nuevo 2026-09-07)
```

---

## Implemented Screens

### Home (`app/(tabs)/index.tsx`)
**Rama por tipo de cuenta (2026-09-07):** `HomeScreen()` lee `profile.is_brand` y renderiza `<BrandHomeView />` o `<ConsumerHomeView />` — mismo criterio que ya usa `app/(tabs)/wardrobe.tsx` para armario vs. catálogo. `ConsumerHomeView` es exactamente el Home que ya existía (sin cambios), documentado abajo. `BrandHomeView` es una pantalla completamente distinta, ver sección propia más abajo.

#### `ConsumerHomeView` (usuarios normales)
- Header: transparent OPA logo (left) + white truck icon (right)
- **Outfit Carousel** with depth effect:
  - `Animated.FlatList` horizontal, `snapToInterval`
  - `scrollX` interpolated → `scale` (0.84→1→0.84) and `opacity` (0.65→1→0.65)
  - Cards: 220×370px, radius 15, shadow
  - Side padding = `(screenWidth - 220) / 2` to center cards
- **Latest Garments**: horizontal scroll, 120×150 cards, name + pink price
- **Brands**: horizontal scroll, 110×110 square cards with black border. Shows logo if available, name otherwise
- **Recently Viewed**: 4 grey placeholder cards (110×150)
- Connected to real data via `useOutfits()`

#### `BrandHomeView` (cuentas de marca, nuevo 2026-09-07)
A pedido explícito del usuario: "que no tengan la misma experiencia" — deliberadamente no es un feed de descubrimiento, es un panel de gestión de la cuenta. Header: logo OPA + avatar circular de la marca (logo_url o inicial), saludo "Hola, {marca}". Secciones, en este orden:
1. **Tráfico de tu cuenta** — carrusel horizontal de 3 tarjetas KPI (Me gusta, Guardados, Seguidores), todo dato real (`useBrandMetrics`). Visitas y Clics a tienda quedaron **afuera a propósito**: no hay tracking de eso en la DB (`GET /api/brands/me/metrics` ya lo aclara en su `note`) y no se iban a inventar números en la app real — a diferencia del mockup de diseño previo a esta implementación, que sí los mostraba como placeholder.
2. **Preguntas sin responder** — título + badge de conteo real (`totalCount` de `useBrandQuestions`) + flecha "→" (mismo glifo que ya usa `SectionHeader`) que navega a `app/brand/questions.tsx`; la flecha y el badge se ocultan si no hay ninguna pendiente. Muestra las primeras 3 (`useBrandQuestions(brandId, {limit:3})`) en cards con avatar (iniciales), texto de la pregunta (2 líneas), "Sobre: {prenda}" o "Sobre: Perfil de la marca", y una pill "Responder" — tocar cualquier parte de la card o la flecha del header lleva a `app/brand/questions.tsx` (no hay un flujo de responder embebido en el Home mismo, a propósito, para no duplicar esa UI).
3. **Tus outfits publicados** — `SectionHeader` con flecha "→" a `/(tabs)/wardrobe` (tab Catálogo → sub-tab Outfits, ya existente). Carrusel horizontal (140×210, mismo placeholder gris que usa el resto de la app cuando no hay foto) de los outfits reales de la marca (`useBrand(brandId).outfits`), con contador de likes superpuesto. **No incluye un botón "+ Nuevo outfit"** — se decidió no construirlo: no existe ninguna pantalla de creación de outfit para marcas todavía en `opa-mobile` (se investigó, no hay precedente), así que hubiera sido un botón sin acción real; ver pendiente en `meta-2026-06-10-pending-features.md`.
4. **Prendas en tendencia** — `SectionHeader` sin flecha (el catálogo completo ya se ve en Catálogo → Prendas). Carrusel horizontal reusando el mismo `garmentCard`/`garmentImageWrap` que `ÚLTIMAS PRENDAS` del Home de consumidor, ordenado por `useTrendingGarments` (RPC `get_trending_garments`, más guardado en los últimos 7 días). Medalla numerada (#1/#2/#3) solo si esa prenda tiene `recent_saves > 0` — nunca se muestra un ranking fabricado sobre datos en cero; en ese caso el texto dice "Sin guardados esta semana" en gris en vez de inventar una tendencia.
5. **Opiniones recientes** — `SectionHeader` sin flecha. **Siempre las últimas 3 reseñas recibidas** entre todas las prendas de la marca (`useBrandReviews`), sin ningún botón de "ver más" — decisión explícita del usuario: para ver el resto de las opiniones de una prenda hay que entrar a esa prenda puntual (`app/product/[id].tsx` ya tiene su propia sección de reseñas completa).

Estados de carga y vacío por sección son independientes entre sí (cada una tiene su propio `loading`/empty state, no hay un loading global de toda la pantalla salvo mientras se resuelve la marca del usuario logueado).

Verificado de punta a punta en browser real logueado como `capas@opa.com`: Tráfico mostrando 1/2/1 (Me gusta/Guardados/Seguidores, todo real), Preguntas sin responder pasando de "No tenés preguntas pendientes" a mostrar una pregunta real con badge tras insertarla desde una cuenta de prueba descartable, Tus outfits publicados en estado vacío (Capas no tiene ninguno), Prendas en tendencia mostrando las 4 prendas reales de Capas (todas en 0 guardados recientes, texto "Sin guardados esta semana", sin medallas), Opiniones recientes en estado vacío. Cuenta de prueba y sus preguntas borradas al terminar.

### Brand Questions (`app/brand/questions.tsx`, nuevo 2026-09-07)
Destino del "→" de la sección "Preguntas sin responder" del Home de marca. Header con flecha `flecha.png` + título centrado (mismo patrón que `app/brand/create-garment.tsx`, no el de `settings.tsx`). Lista completa (sin límite) de `useBrandQuestions(brandId)`. Responder es **inline, sin pantalla ni modal aparte**: tocar "Responder" en una card expande un `TextInput` + botones Cancelar/Enviar respuesta dentro de la misma card (estado local `openId`); al confirmar, `answer(questionId, texto)` hace el UPDATE y la pregunta desaparece de la lista (tanto acá como, al volver, del Home). Verificado de punta a punta con una cuenta de prueba descartable: preguntar como usuario → responder como Capas → fila confirmada en la DB con `answer`/`answered_at` seteados.

**Preguntar, del lado del usuario — reworkeado a Q&A público estilo Mercado Libre (2026-09-07, misma sesión que lo creó):** la versión original tenía 2 puntos de entrada (una prenda puntual, o la marca en general desde `app/marca/[id].tsx`) y las preguntas solo las podía leer quien preguntó o la marca. El usuario pidió el modelo Mercado Libre en su lugar: **se sacó el botón "Preguntar" de `app/marca/[id].tsx`** (ya no hay forma de preguntarle algo general a una marca, solo sobre una prenda puntual) y **la sección de `app/product/[id].tsx` pasó a ser pública** — ver "Preguntas y respuestas" en la sección Product Detail más abajo. Esto además cierra solo, sin pantalla nueva, el pendiente de "el usuario que pregunta no ve la respuesta": ahora la ve en la misma publicación, junto con las de cualquier otro usuario.

### Outfit Scroll (`app/(tabs)/outfits.tsx`)
- Full-screen `FlatList` with `pagingEnabled` — vertical TikTok-style scroll. En web, `snapToInterval` es un no-op (react-native-web 0.21.2); el snap real lo da `pagingEnabled`. El `FlatList` fuerza `style={{ height: pageH }}` (viewport == alto de cada item) para que el snap no quede desalineado.
- `pageH = SH - tabBarHeight`: cada item mide el alto de ventana menos el alto real de `BottomNavBar` (que se dibuja encima del contenido, no reserva espacio) — si no se descuenta, la barra de precio queda tapada por la nav.
- Floating header: camión (`assets/camion_blanco.png`, imagen real — no emoji) a la izquierda + tabs "tus marcas / Descubrir" al centro (sin separador "/", sin pill oscuro de fondo — texto plano sobre la foto con subrayado rosa 2px en la tab activa) + botón "+" a la derecha (solo el signo, sin círculo/borde)
- **Tab "tus marcas" (2026-08-07):** filtra el feed a outfits que tienen al menos una prenda de una marca que el usuario sigue (criterio "al menos 1 prenda", decidido por el usuario — no exige mayoría ni exclusividad). Nuevo hook `hooks/useFollowedBrandIds.ts` resuelve `follows.following_id` → `marcas.id` en dos pasos (el follow de marca usa la misma tabla `follows` que el follow entre usuarios, ya que `marcas.profile_id` es un `perfiles.id`). Estados vacíos: "Todavía no seguís ninguna marca" si `followedBrandIds` está vacío, o "Todavía no hay outfits..." si sigue marcas pero ninguna coincide con un outfit. Al cambiar de tab se resetea `activeIndex` y el scroll vuelve al inicio (el largo de la lista cambia). Verificado en el browser logueado como `capas@opa.com`: siguiendo a Sole (presente en las 7 prendas/outfits seed) aparecen los 7 outfits; sin seguir ninguna marca aparece el estado vacío; "Descubrir" no tuvo regresión.
- `OutfitScrollItem` por item: imagen full-bleed (sin overlay oscuro de gradiente) + UI superpuesta
- Chips de prenda flotantes (thumbnail + nombre + precio) con líneas conectoras en forma de codo hacia un punto en la prenda; el ancla se deriva del `slot` de cada prenda (no hay coordenadas `position_x/position_y` en la DB — ver limitación en pending-features.md)
- Botones de acción (like/save/share): iconos blancos sin círculo de fondo, 34×34px, gap 20, sobre la foto directamente (sin contador numérico visible)
- Info del creador (avatar + nombre + título del outfit) abajo a la izquierda — sigue mostrando el **creador**, no la marca, hasta que exista onboarding de cuentas de marca con outfits propios
- Barra de precio flotante (no pegada al fondo): ícono de bolsa rosa + "Precio total" + monto + botón "Ver outfit"
- Connected to `useOutfits()`

### Profile (`app/(tabs)/profile.tsx`)
Four states:

1. **Initializing** (`!initialized`): centered `ActivityIndicator`
2. **No session** (`!session`): Auth gate con logo OPA + botones iniciar sesión / crear cuenta
3. **Cuenta de marca** (`profile.is_brand === true`): `<Redirect>` a `/marca/[id]` (con `id` = la marca via `useMyBrand`) — la cuenta de marca nunca ve este layout de perfil personal
4. **Con sesión (personal)**: full profile
   - Header horizontal: avatar 80×80 (izquierda) + username / nombre / bio / ig handle / tags (derecha)
   - Settings icon (arriba derecha) → `app/settings.tsx`
   - Stats: Seguidores · Seguidos · Outfits · Guardados (valor real de `outfits_guardados`)
   - **3 tabs con iconos PNG** del bucket `assets`:
     - **Grid** (`Grid.png` / `Grid_rosa.png`): grilla 3 columnas de outfits propios → tap → `user-outfits.tsx`
     - **Favoritos** (`estrella_gris.png` / `estrella_negra.png`): 2 sub-tabs:
       - **Outfits** (`nav/outfit_v2.png`): grid de outfits guardados → tap → `saved-outfits.tsx`
       - **Prendas** (`percha_negra.png`): grid 4 columnas de `prendas_guardadas`
     - **Pedidos** (`caja_negra.png` / `caja_rosa.png`): empty state
   - Al activar Favoritos se hace `refetch()` de outfits y prendas guardadas

### Product Detail (`app/product/[id].tsx`)
Rediseño completo 2026-08-10 — antes era una vista básica (imagen, talle, CTA sin `onPress`); ahora es la vista "estilo Shein" pedida por el usuario, con todas las funcionalidades de compra que existían en la DB pero no estaban conectadas al frontend. Ver decisiones de alcance abajo.

- Parámetro: `id` (garment ID)
- Fetch directo a `prendas` con join `brand:marcas(*)` vía `supabase.maybeSingle()`; fetch aparte de `related` (hasta 8 prendas del mismo `brand_id`, excluyendo la actual)
- Hooks: `useSizeGuide`, `useRecommendedSize`, `useSaveGarment` (nuevo), `useCart` (nuevo), `useGarmentReviews` (nuevo)
- **Header flotante** sobre la imagen: back (`flecha.png`) a la izquierda; compartir (`compartir.png`, `Share.share` nativo) + carrito (`bag_negra.png` con badge rosa de cantidad) a la derecha — el carrito es alcanzable desde acá en cualquier momento, no solo tras agregar algo
- **Imagen:** full-width, aspect ratio 1:1.1, tap abre `ZoomableImage` (visor full-screen, doble tap para zoom 2.2x). Sin galería — cada prenda tiene una sola `image_url` en la DB (decisión del usuario: no tocar el schema para esto ahora)
- **Botón guardar** (★/☆, mismo glifo que usa el resto de la app para "guardar/bookmark", no un corazón) flotando sobre la esquina inferior derecha de la imagen — toggle real contra `prendas_guardadas` vía `useSaveGarment`. Si no hay sesión, redirige a `/auth`
- **Brand row:** logo circular 28px (o inicial si sin logo) + nombre de marca → tap navega a `/marca/[id]`
- **Nombre + precio + color:** precio en `rosaOpa`; si la prenda tiene `color`, se muestra un swatch (dot) al lado — el color se aproxima a un hex desde el nombre libre en español (`colorToHex()`, sin columna de hex en la DB) más el nombre como texto
- **Selector de talle:** chips horizontales con wrap; estados: default / selected (negro) / recomendado (borde `rosaOpa` 2px) / **agotado** (fondo gris, texto tachado, deshabilitado — nuevo, cruza `stock_por_talle`). Botón "ⓘ Guía de talles" → abre `SizeGuideSheet`. Debajo: hint de talle recomendado, o **urgencia de stock** ("¡Últimas N unidades!" si `stock_por_talle[talle] <= 5`) o "Sin stock en este talle"
- **Cantidad:** stepper +/− (nuevo), clamp entre 1 y el stock del talle seleccionado (o 10 si la prenda no tiene talles)
- **Tags:** categoría + estilo como chips con borde `bordeTag`
- **"Más de {marca}"** (nuevo): fila horizontal con otras prendas de la misma marca → tap navega a otra `product/[id]`
- **Reseñas** (nuevo): lee `reseñas` vía `useGarmentReviews` — estrellas promedio + lista de comentarios si hay filas, o estado vacío "Aún no hay reseñas de esta prenda" (la tabla está vacía hoy — requiere `order_id`, o sea compra verificada, y todavía no hay flujo de compra; queda lista para cuando haya datos reales)
- **"Preguntas y respuestas"** (nuevo 2026-09-07, reworkeado el mismo día a formato público estilo Mercado Libre): sección debajo de Reseñas con dos partes. (1) **Form para preguntar** (`TextInput` + "Preguntar", `useAskQuestion().ask(brand_id, texto, garment_id)`) — oculto para viewers de marca (`viewerIsBrand`); redirige a `/auth` sin sesión; al enviar limpia el input y hace `refetch()` de la lista, así la pregunta nueva aparece al toque, marcada "Todavía sin responder". (2) **Lista pública de Q&A** (`hooks/useGarmentQuestions.ts`, nuevo) — TODAS las preguntas de esa prenda (respondidas o no), visibles para cualquiera que entre a la publicación, logueado o no: "P: {pregunta}" + `@usuario · hace X`, y "R: {respuesta}" si ya la contestaron o "Todavía sin responder" en itálica si no. Esto es lo que la diferencia de la primera versión (privada, solo el asker/la marca la veían) — ahora cualquiera puede leer preguntas que hicieron otros usuarios, como pidió el usuario explícitamente. RLS pública nueva en `database-2026-06-06-schema-and-seed.md` (`public_select_garment_questions`). **No hay control de responder acá** — eso sigue siendo exclusivo de la marca desde su Home + `app/brand/questions.tsx`, para no duplicar esa UI. Verificado de punta a punta con una cuenta de prueba descartable: pregunta creada visible al instante, visible también deslogueado, respuesta de Capas visible después deslogueado también.
- **CTA condicional por tipo de cuenta (nuevo, 2026-09-07):** a pedido explícito del usuario ("cuando abro una prenda no debería tener ni la opción de agregar al carrito ni de añadir a favoritos... debería tener la opción de editar en vez de eso"). `isOwnGarment = viewerIsBrand && myBrand?.id === garment.brand_id` (nuevo `useMyBrand` en este archivo) decide tres casos: **consumidor normal** → sin cambios (CTA de siempre); **marca viendo su propia prenda** → sin botón de guardar (★/☆) ni ícono de carrito en el header, el CTA de abajo pasa a ser "Editar prenda" → `router.push('/brand/create-garment?id=' + garment.id)`; **marca viendo la prenda de otra marca** → sin guardar/carrito, y **sin ningún CTA** (no tiene sentido comprar ni editar algo ajeno). Verificado en browser real: prenda propia de Capas sin ★/carrito y con "Editar prenda"; prenda de Forma vista como Capas sin ningún CTA al final.
- **CTA sticky:** `sale_mode === 'redirect'` → "Ver en tienda →" (ahora sí conectado, `Linking.openURL(garment.external_url)`); `direct` → "Agregar al carrito" — ahora hace un INSERT/UPDATE real en `productos_carrito` vía `useCart().addItem()` (si ya existe una fila con mismo talle, suma cantidad en vez de duplicar), deshabilitado si falta seleccionar talle o si no hay stock, muestra "Sin stock" en el botón cuando corresponde. Si no hay sesión, redirige a `/auth`. Toast simple ("Agregado al carrito") tras el insert
- **Prenda descontinuada (2026-08-14):** si `garment.descontinuada`, aparece un banner gris arriba del nombre ("Esta prenda fue descontinuada por la marca") y el CTA se reemplaza por un botón deshabilitado "Ya no disponible" (pisa tanto `direct` como `redirect`) — sigue siendo posible **ver** la prenda (ej. si aparece referenciada en un outfit ya publicado), solo se bloquea la compra. `fetchRelated` ("más de esta marca") también filtra `descontinuada = false`.
- **`SizeGuideSheet` (inline, sin cambios):** `Modal` con `animationType: 'slide'`, `transparent`, overlay semitransparente. Tabla horizontal scrolleable con columnas adaptadas por categoría: `calzado` → pie; `piernas`/`bottoms` → cintura/cadera/muslo; default → busto/cintura/cadera. Fila del talle recomendado destacada en `rosaOpaLight` con texto `rosaOpa`. Banner inferior con el talle recomendado.
- **`ZoomableImage` (`components/product/ZoomableImage.tsx`, nuevo):** visor full-screen con doble tap para alternar zoom 1x↔2.2x (`Animated.spring`). **Nota de implementación:** se probó primero una versión con `PanResponder` (pellizco con 2 dedos + paneo continuo), pero en este entorno (react-native-web 0.21, sin `GestureHandlerRootView` montado a nivel root) dejaba el sistema de responders trabado — una vez abierto el modal, ningún botón de la pantalla (ni el propio botón de cerrar) volvía a responder a taps. Se reemplazó por una versión sin `PanResponder` (solo `onPress`/doble-tap, mismo mecanismo que el resto de los botones de la app). **Limitación de testing conocida (no es un bug de producto):** en el browser headless de esta sesión, cerrar CUALQUIER `Modal` de RN (incluido el `SizeGuideSheet` preexistente, no tocado en esta sesión) vía click sintético no funcionó — se confirmó que es una limitación del entorno de automatización con `Modal`, no algo introducido acá, así que no se puede asegurar al 100% que el botón "✕" del zoom funcione hasta probarlo en un dispositivo/browser real con gestos reales.

### Carrito (`app/cart.tsx`, nuevo 2026-08-10)
Pantalla **muy básica y temporal** (decisión explícita del usuario) para poder ver/editar lo que ya inserta `app/product/[id].tsx` en `productos_carrito` — no hay checkout todavía, eso queda como pendiente aparte.
- Hook `hooks/useCart.ts`: lee `productos_carrito` del usuario logueado con join a `prendas`/`marcas`; expone `addItem`, `updateQuantity`, `removeItem`, `total`, `count`
- **Lista:** imagen + marca + nombre + talle + precio + stepper de cantidad + botón sacar (✕) por fila; tap en la fila navega a `product/[id]`
- **Footer:** total sumado + botón "Finalizar compra (próximamente)" deshabilitado a propósito (no hay checkout implementado)
- **Entry point:** ícono de bolsa (`bag_negra.png`) con badge de cantidad en el header de `app/product/[id].tsx` — no se agregó entry point en otras pantallas (fuera de alcance de este pedido)
- Estado vacío: 🛍️ + "Tu carrito está vacío"

### Nuevos hooks de esta sesión (2026-08-10)
- `hooks/useSaveGarment.ts` — toggle de `prendas_guardadas` (favoritos de compra), mismo patrón optimista que `useLike`/`useSave`
- `hooks/useCart.ts` — CRUD básico sobre `productos_carrito` (ver arriba)
- `hooks/useGarmentReviews.ts` — lee `reseñas` de una prenda + promedio de rating

### Create Garment (`app/brand/create-garment.tsx`, nuevo 2026-08-10)
Formulario para que una cuenta de marca cree una prenda nueva, publicándola directo en su catálogo. Antes de esto no existía ningún camino en la app para cargar una prenda — el dato del catálogo era 100% seed. Ver decisiones de alcance en `product-2026-06-10-brand-system.md` → "What a Brand Can Do".

- **Entry point:** botón "+ Agregar prenda" en el header del tab Prendas de `app/(tabs)/wardrobe.tsx` (`BrandCatalogView`), visible solo ahí (junto al contador de prendas)
- **Imagen:** primera vez que la app sube un archivo desde el cliente. `expo-image-picker` (nueva dependencia, plugin agregado a `app.json` con el texto de permiso de galería) + `lib/uploadImage.ts` (nuevo) sube el blob al bucket público `assets`, path `prendas/{marca-slug}/{prenda-slug}_{marca-slug}_{timestamp}.{ext}` (mismo patrón de naming que ya documentaba `database-2026-06-06-schema-and-seed.md`, con timestamp en vez de "colección"). La extensión se deriva del `blob.type` del archivo elegido, no de la URI local — en web la URI es un `blob:` sin extensión real, parsearla daba `.jpg` para cualquier imagen. **La imagen es obligatoria**: se descubrió recién al probar (no al leer el schema) que `prendas.image_url` tiene `NOT NULL` en la DB — el formulario originalmente la trataba como opcional y el submit fallaba con el error crudo de Postgres hasta que se agregó la validación.
- **Campos:** nombre, descripción, precio, categoría (Torso/Piernas/Calzado/Extras, chips, single-select), color (chips, single-select, paleta estandarizada de 17 — ver bullet 2026-09-14 abajo; antes era texto libre), estilo (sigue siendo texto libre, ej. "street"/"vintage"/"minimal" — mismos valores que ya usa el seed, sin picker rígido, fuera de alcance de la estandarización de color)
- **Talles y stock:** aparece recién al elegir categoría — chips por talle (XS–XXL para torso/piernas/extras, EU 35–42 para calzado, hook `sizeOptionsFor()`); tocar un talle lo activa con un input de stock al lado (default "10", editable). Arma `available_sizes` + `stock_por_talle` directamente de los talles activados.
- **Guía de talles (opcional):** hook nuevo `hooks/useSizeGuidesForCategory.ts` — lista las guías de OPA (`brand_id IS NULL`) + las propias de la marca si tuviera, filtradas por categoría con el mismo mapeo torso→tops / piernas→bottoms / calzado→calzado / extras→extras que ya usa `measurementCols()` en `app/product/[id].tsx`. **No permite crear una guía propia en este flujo** — decisión confirmada con el usuario: `size_guide_entries` (las medidas por talle) solo acepta INSERT de `service_role` vía RLS, así que una guía custom necesita un endpoint nuevo en `opa-backend` que esta sesión no puede construir ni desplegar (repo no clonado acá, sin `supabase`/`gh` CLI, MCP de Supabase sin autorizar). Queda como pendiente con el detalle técnico en `product-2026-06-10-brand-system.md`.
- **Modo de venta:** Directo en OPA / Redirigir a mi tienda (segmented); si redirect, input de URL obligatorio
- **Submit:** sube la imagen (si hay una nueva), arma el payload y llama `api.createGarment()` (nuevo método en `lib/api.ts`) → `POST /api/brands/me/prendas` en `opa-backend` — **primera vez que `opa-mobile` usa ese endpoint**, que ya existía (comentado "para opa-web") pero nadie lo llamaba desde el móvil. Reusa el mismo cliente `lib/api.ts` que ya se armó para like/save. Errores del backend (ej. validación de `external_url`) se muestran tal cual en un banner de texto rosa arriba del botón.
- Al crear con éxito, `router.back()` vuelve al catálogo; `hooks/useBrand.ts` ganó un `refetch()` nuevo y `BrandCatalogView` lo llama con `useFocusEffect` (`@react-navigation/native`, ya disponible como dependencia de expo-router) cada vez que la pantalla recupera foco, así la prenda nueva aparece sin acción extra.
- **Gap real encontrado al probar (2026-08-10):** no hay forma de editar ni borrar una prenda después de crearla. Borrar en particular está bloqueado por RLS, no es solo falta de UI — un DELETE contra `prendas` con la sesión de la propia marca devuelve `200` con body vacío (RLS lo filtra silenciosamente). Detalle completo y qué hace falta en `product-2026-06-10-brand-system.md`.
- Verificado end-to-end en browser real logueado como `capas@opa.com`: formulario completo, selector de categoría → talles/guía aparecen dinámicamente, imagen simulada subida de verdad a Storage (bucket `assets`, path correcto, mime-type correcto tras el fix), prenda creada en `prendas` con todos los campos esperados, catálogo actualizado sin recargar. La prenda de prueba (`Buzo Test Automatizado`) quedó en el catálogo real de Capas porque no se pudo borrar por RLS — el usuario la va a sacar manualmente desde `opa-admin`.

**Color estandarizado, en dos pasadas el mismo día (2026-09-14):** a pedido explícito del usuario, tras encontrar en producción colores como `"cognac"` y `"Negro con mucho texto también"` sin ninguna validación.

*Primera pasada:* el campo "Color" pasó de `TextInput` libre a una fila de chips single-select (17 valores de `GARMENT_COLORS`, lista cerrada, sincronizada a mano con un `CHECK constraint` en la DB).

*Segunda pasada, un rato después:* el usuario pidió sacar "Multicolor" de la lista, agregar una opción **"Otro" con texto libre**, y convertir **tanto Color como Estilo** en selectores desplegables (no chips sueltos) — "que estilo y color sean desplegables... que pongas al lado de cada nombre un circulito con el color". Se construyó `DropdownField` (nuevo componente, mismo archivo), un campo tipo "select" que al tocarlo abre una hoja (`Modal`, mismo patrón que `SizeGuideSheet` de `app/product/[id].tsx`) con la lista de opciones + fila final `"+ Otro"`:
- **Color:** 16 opciones de `GARMENT_COLORS` (`constants/garmentColors.ts`, ahora con `hex` por color), cada fila con un circulito de swatch (`GARMENT_COLOR_HEX`) + el nombre. El campo colapsado también muestra el swatch al lado del valor elegido. "Otro" abre un `TextInput` inline dentro de la misma hoja (con "‹ Volver a la lista" y botón "Listo"); si el valor final no está en `GARMENT_COLORS` (vino de "Otro"), se muestra con un swatch gris genérico (no se conoce su hex).
- **Estilo:** mismo componente `DropdownField`, sin `swatches`, con las opciones dinámicas de siempre (valores reales de `prendas.style`, deduplicados — ahora vía el helper compartido `lib/text.ts` → `dedupeCaseInsensitive`, extraído de `app/(tabs)/search.tsx` para no duplicarlo) + "Otro" también, porque forzar un dropdown 100% cerrado sobre un campo sin enum real bloquearía introducir un estilo nuevo que ninguna prenda usa todavía.
- **DB:** el `CHECK constraint` de lista cerrada (`prendas_color_check`, primera pasada) se reemplazó por uno liviano (`prendas_color_length_check`: no vacío, ≤30 caracteres) vía la migración `relax_prendas_color_check_allow_custom` — una lista cerrada es incompatible con "Otro" por diseño. Detalle completo del trade-off en `database-2026-06-06-schema-and-seed.md`.
- Reabrir el editor con un color/estilo que vino de "Otro" precarga la hoja directo en modo "Otro" con el texto ya escrito (no en la lista, con el botón "Volver a la lista" disponible para cambiar de opinión).

Verificado en browser real logueado como Capas: hoja de Color con los 16 swatches + "+ Otro" al final; elegir "Otro" y escribir "Turquesa" lo guarda con un PATCH real (confirmado en la DB); reabrir el editor con `color:"Turquesa"` reabre en modo "Otro" con el texto precargado; volver a la lista y elegir "Beige" lo revierte correctamente (confirmado en la DB, sin dejar el dato de prueba cambiado). Estilo con las mismas opciones reales de antes (`Diario`, `elegante`, `minimal`, `street`, `vintage`) sin swatch. `tsc` limpio.

**Modo edición (2026-09-07):** la misma pantalla ahora sirve para editar — `app/brand/create-garment.tsx?id=<garmentId>`. Antes de tocar código se confirmó en vivo (PATCH real contra `capas@opa.com`, revertido después) que `PATCH /api/brands/me/prendas/:id` acepta los mismos 12 campos que el POST de creación, así que no hizo falta un endpoint nuevo. Al montar con `id`, hace un `select('*')` directo a `prendas` (público, RLS lo permite) y precarga cada campo del form; si `data.brand_id !== brand.id` (alguien intentó editar una prenda ajena vía URL) muestra "No tenés permiso para editar esta prenda" en vez del formulario — la escritura real ya estaba protegida por RLS/la API de todos modos, esto es solo para no mostrarle a la marca datos de un catálogo ajeno en su propio formulario. **Detalle no obvio:** el `useEffect` que resetea talles/guía al cambiar de categoría (pensado para cuando el usuario elige otra categoría a mano) se ejecutaría también al precargar `category` por primera vez, borrando el stock recién cargado — se resolvió con un `useRef` que salta ese reset una sola vez, justo después de la precarga. Imagen: si no se elige una foto nueva, se reusa `existingImageUrl` tal cual (no vuelve a subir nada). Título del header y texto del botón cambian a "Editar prenda"/"Guardar cambios". Verificado en browser real: formulario precargado con los 10 campos reales de "Trench Camel" de Capas, cambio de precio guardado con un PATCH real (confirmado en la DB y revertido después para no dejar el dato de prueba).

### Puntos de apertura de una prenda ("abrir en todo momento")
A pedido del usuario se revisaron y conectaron todos los lugares donde se muestra una prenda pero no se podía tocar para abrirla (antes solo funcionaba desde armario, catálogo de marca, búsqueda y detalle de outfit):
- **`components/outfit/OutfitScrollItem.tsx`** — el chip flotante de cada prenda en el scroll principal (TikTok-style) no tenía `onPress`; ahora navega a `product/[id]`. Este era el punto de entrada más usado de la app y el que más claramente motivó el pedido.
- **`app/(tabs)/index.tsx`** — las cards del carrusel "Últimas Prendas" en Home no tenían `onPress`; ahora navegan a `product/[id]`.
- Se decidió explícitamente **no** armar un bottom-sheet global de "vista rápida" abierto desde cualquier lugar sin navegar — el usuario eligió la opción más simple (arreglar los puntos muertos para que naveguen a la pantalla completa existente) en vez de esa alternativa.

### Bug preexistente encontrado y NO arreglado (fuera de alcance, flagged aparte)
El botón "Ver outfit" en la barra inferior de `OutfitScrollItem.tsx` (bottom bar del scroll principal) tampoco tiene `onPress` — no navega a `outfit/[id]`. Es un bug real pero de alcance de *outfit*, no de *prenda*, así que quedó fuera de esta sesión; se dejó una tarea en background para no perderlo.

### Outfit Detail (`app/outfit/[id].tsx`)
- Parámetro: `id` (outfit ID)
- Fetch a `outfits` con join `creator:perfiles(id, username, avatar_url)` + `garments:outfit_items(*, garment:prendas(*, brand:marcas(*)))`
- **Header:** botón back + título del outfit centrado
- **Cover image:** full-width, aspect ratio 1:1.25
- **Creator row:** avatar 32px + `@username` → tap navega a `user-outfits?userId=...&startIndex=0`
- **Tags:** `occasion` + `style` como chips
- **Stats:** likes_count + saves_count
- **Lista de prendas (PRENDAS):** `GarmentRow` por prenda — thumbnail 60×60 + nombre + marca + slot label + precio `rosaOpa` → tap navega a `product/[id]`
- **Slot grid:** thumbnails 72×90 agrupados por slot (Torso / Piernas / Calzado / Extras); slots vacíos no se renderizan
- **CTA sticky:** total price izquierda + botón "Ver outfit completo" derecha

### Search (`app/(tabs)/search.tsx`)
Es el mismo buscador para cuentas normales y de marca — una cuenta de marca no tiene acceso al tab Outfits/feed, pero sí a Search (ver `BottomNavBar.tsx`), y lo usa para navegar el resto de OPA (otras marcas, inspiración).

- Búsqueda con debounce de 350ms sobre `query` + `activeTag` + `tab` + precio + orden
- **Search bar:** input con `backgroundColor: grisBorde`, icono 🔍, botón ✕ para limpiar
- **Tabs:** Outfits / Prendas / **Cuentas** (clave interna sigue siendo `'marcas'`, solo cambió el label mostrado — ver bullet 2026-09-04 más abajo) — cambia el target de búsqueda; borde inferior `rosaOpa` en activo; cambiar de tab resetea `activeTag` (los vocabularios de tags de Outfits y Prendas son distintos, no tiene sentido arrastrar la selección)
- **Query outfits:** `.textSearch('search_vector', query, { type: 'websearch', config: 'spanish' })` (full-text sobre title+description) + `.or('style.ilike...,occasion.ilike...')` — `LIMIT 30`, orden elegible (ver abajo)
- **Query prendas:** `.textSearch('search_vector', query, { type: 'websearch', config: 'spanish' })` (full-text sobre name+description+nombre de marca) + `.eq('category', ...)` (salteado si el chip es "Todo") + `.gte/.lte('price', ...)` — `LIMIT 100` (subido de 30 el 2026-09-14 para no truncar antes del filtro client-side de color/estilo, ver bullet abajo), orden elegible; color/estilo se filtran después, en JS
- **Query marcas (2026-08-14) + usuarios (2026-09-04, tab "Cuentas"):** dos queries en paralelo (`Promise.all`) sobre `marcas` (`.or('name.ilike...,description.ilike...')`) y `perfiles` (`.eq('is_brand', false).or('username.ilike...,display_name.ilike...')` — se excluyen perfiles `is_brand=true` porque esa cuenta ya aparece vía `marcas`), combinadas en un solo array `AccountResult` (`{kind:'marca'|'usuario', ...}`). Sin full-text ni migración en ninguna de las dos, tablas chicas hoy (7 marcas, decenas de perfiles) — si crecen mucho, considerar `search_vector` igual que outfits/prendas. Resultado en filas (no grid): logo/avatar circular 52px + nombre + **etiqueta chica "MARCA"/"USUARIO"** junto al nombre (`accountKindTag`, borde `bordeTag`, texto uppercase) + badge `verificado_ondas.png` si es marca verificada + descripción/bio 1 línea → tap navega a `/marca/[id]` o `/user/[id]` según `kind`. Placeholder del search bar actualizado a "Outfits, prendas, marcas, usuarios...".
- **Tag filters (2026-08-14, reemplazó la lista fija; ajustado 2026-09-04):**
  - **Prendas:** chips de categoría real (`Torso`/`Piernas`/`Calzado`/`Extras`, `CATEGORY_TAGS` constante — mismo enum que `prendas.category`), filtran con `.eq('category', key)` en vez de `ilike` sobre `style`. **Sin `#`** (2026-09-04, a pedido del usuario tras un screenshot: "Calzado", no "#Calzado") — los de Outfits sí mantienen el `#` (son hashtags de estilo/ocasión, no un enum de categoría). **Chip "Todo" primero en la fila (2026-09-14)**, ver bullet dedicado más abajo.
  - **Outfits:** chips de `style`/`occasion` **traídos dinámicamente** de lo que existe hoy en la tabla (`SELECT style/occasion WHERE NOT NULL`, deduplicado client-side, cargado una vez al montar la pantalla) — reemplaza la lista vieja de 13 tags inventados a mano, que no coincidía con los valores reales de seed y devolvía 0 resultados en varios casos. Con el volumen actual (decenas de outfits) el costo de esta query es despreciable; si la tabla crece mucho, pasar a una query `DISTINCT` server-side o RPC.
  - **Marcas:** sin chips — son pocas, alcanza con el texto.
- **Filtro de precio (2026-08-14, solo tab Prendas):** dos inputs numéricos chicos (Min/Max) sobre `prendas.price`, mismo debounce que el resto. **Desde el 2026-09-14 vive dentro del panel de filtros plegable** (ver bullet dedicado más abajo) en vez de una fila siempre visible.
- **Orden (2026-08-14, pills; dentro del panel plegable en Prendas desde 2026-09-14):**
  - Outfits: **Populares** (`likes_count DESC`, default — mismo comportamiento que antes) / **Recientes** (`created_at DESC`)
  - Prendas: **Recientes** (`created_at DESC`, default — mismo comportamiento que antes) / **Precio ↑** / **Precio ↓**
  - Cuentas: sin selector, marcas y usuarios cada uno ordenados alfabéticamente por separado (marcas primero, luego usuarios — no interleaved)
- **Grid resultados** (Outfits/Prendas): 2 columnas, cards con imagen + título/nombre + creator/brand; tap navega a `outfit/[id]` o `product/[id]`
- Estado vacío inicial: ícono 👗 + texto descriptivo. Sin resultados: mensaje con el query.
- **Full-text search (2026-08-10):** reemplazó el `.ilike()` anterior, que solo matcheaba `title`/`name` — no encontraba nada al buscar por texto de la descripción ni por nombre de marca (ninguna prenda se llama literalmente "Capas", por ejemplo). Columnas `search_vector` (`tsvector`, config `'spanish'`, con stemming — buscar "vestido" encuentra también "vestirse") + índice GIN en `outfits` y `prendas` (ver `database-2026-06-06-schema-and-seed.md`). Verificado en browser: "Capas" en tab Prendas trae las 4 prendas de esa marca; "vestido" en tab Outfits trae "noche sin esfuerzo" (tiene "vestido" en la descripción) y "otoño en Palermo" (tiene "vestirse" — misma raíz).
- **Verificado en browser (2026-08-14):** tab Marcas con "Capas" trae la marca real con su descripción; tab Prendas con precio mínimo $5000 + orden Precio ↑ trae solo prendas ≥ $9.800 en orden ascendente; agregar el chip #Calzado sobre eso deja solo las 7 zapatillas/botas de Sole, precio ascendente, min $5000 respetado. Sin cambios de DB — todo usa columnas que ya existían (`category`, `price`, `marcas.name/description`), no hizo falta `opa-backend` ni el MCP de Supabase (no autorizado esta sesión).
- **Bug real encontrado por el usuario, no por mí (2026-08-14):** la primera verificación de esta misma sesión se hizo solo leyendo el DOM (`read_page`/`get_page_text`), sin capturar pantalla — pasó por alto que el `FlatList` horizontal de chips se renderizaba estirado a casi toda la altura de la pantalla (mismo bug de `flexGrow` en react-native-web que ya se había resuelto una vez en `outfits.tsx`, ver `CLAUDE.md` → Decisiones técnicas críticas). El usuario mandó un screenshot real de su celular mostrando los chips como cajas verticales gigantes. Fix: `style={{ flexGrow: 0 }}` (estilo `tagListWrapper`) en el `FlatList` de tags — confirmado por medición de `getBoundingClientRect` post-fix (chip de ~26px de alto en vez de ~700px). **Lección de proceso:** para listas horizontales nuevas, no alcanza con verificar el contenido por DOM/texto — hay que confirmar dimensiones reales (`getBoundingClientRect` como mínimo, screenshot si el pane lo permite). Se dejó una tarea flageada para revisar si `app/(tabs)/wardrobe.tsx` (filtro de slots, misma estructura) tiene el mismo bug sin detectar.
- **Segunda variante del mismo bug de `FlatList` horizontal — esta vez colapso, no estiramiento (2026-09-04):** el usuario mandó un screenshot mostrando el chip activo (fondo negro, tab Prendas) como una barra sólida sin texto legible. Causa raíz distinta a la de 2026-08-14 pese al síntoma parecido: con `flexGrow:0` ya aplicado, la fila de tags es hermana del `FlatList` de resultados (grid) dentro de un contenedor `flex:1` — por default en react-native-web todo `View`/`ScrollView` tiene `flex-shrink:1`, así que apenas el contenido total de la pantalla no entra en el alto disponible (típico: tab Prendas con resultados cargados, antes de eso con el empty-state no pasaba), el layout le "roba" espacio a la fila de tags para dárselo al grid — se encoge al mínimo de una sola línea de texto (~16px), recortando el resto del chip. Con fondo blanco el recorte era casi invisible (por eso no se había notado); con el chip activo (fondo negro) tapaba el texto por completo. Un primer intento de fix (solo agregar `height: 44` sin `flexShrink`) no alcanzó — el navegador sigue permitiendo que el item se encoja por debajo de su `height` explícito porque `height` solo fija el `flex-basis` inicial, no el mínimo. Fix real: `tagListWrapper: { flexGrow: 0, flexShrink: 0, height: 44 }`. Verificado con `getBoundingClientRect` (chip vuelve a medir 16px de alto para el texto, sin recorte del contenedor) y visualmente en screenshot. **Lección de proceso, ampliando la de 2026-08-14:** con una lista horizontal de tamaño fijo que convive con un sibling que sí necesita crecer/scrollear (un grid de resultados, típicamente), no alcanza con `flexGrow:0` — hace falta también `flexShrink:0`, si no el layout puede "robarle" espacio a la lista chica cuando el hermano grande no entra en pantalla.
- **Chip "Todo" + panel de filtros avanzados plegable en Prendas (2026-09-14):** a pedido explícito del usuario. Dos piezas:
  - **Chip "Todo" (`CATEGORY_TAGS`):** nueva entrada `{ key: 'todo', label: 'Todo' }` que va primera en la fila de categorías de Prendas (antes de Torso/Piernas/Calzado/Extras) — no es una categoría real de `prendas.category`, es un valor especial que la query trata como "sin filtro de category" (`if (tag && tag !== 'todo') q = q.eq('category', tag)`), así que tocarlo trae las 4 categorías mezcladas. No queda seleccionado por default al entrar al tab (mismo comportamiento que los demás chips: hay que tocarlo) — se decidió así para no cambiar el empty-state existente ("Descubrí looks...") con una carga automática no pedida.
  - **Panel de filtros plegable:** ícono nuevo a la derecha de la fila de chips (`filtro_negro.png` cerrado / `filtro_rosa.png` abierto — subidos por el usuario a la raíz del bucket `assets`, confirmados por HEAD request antes de usarlos) que togglea `filtersOpen`. Al abrirse muestra, todo consolidado en un solo panel (decisión del usuario: mover ahí lo que antes era una fila siempre visible, no dejarlo aparte): **Precio** (los mismos inputs min/max de antes), **Ordenar por** (los mismos pills de antes), **Color** y **Estilo** (nuevos, multi-select — podés marcar varios colores/estilos a la vez, se combinan con OR dentro del mismo campo y AND entre campos distintos). Botón "Limpiar" resetea precio/orden/color/estilo de un toque. El panel se cierra y sus filtros se resetean al cambiar de tab (Outfits/Cuentas no lo usan).
  - **Estilo es texto libre, no un enum** (`prendas.style`) — con datos reales inconsistentes en mayúsculas. Mismo criterio que `outfitTags`: se traen los valores reales que existen hoy (`SELECT style WHERE NOT NULL AND descontinuada=false`), deduplicados ignorando mayúsculas (`dedupeCaseInsensitive`, se queda con la primera variante de casing que aparece).
  - **Color (2026-09-14, corregido el mismo día, y otra vez un rato después):** originalmente implementado igual que Estilo (valores reales de la tabla) — mostraba solo los colores que ya tenían alguna prenda cargada. El usuario pidió lo contrario: mostrar siempre las opciones de la paleta estandarizada (`GARMENT_COLORS` de `constants/garmentColors.ts`), tenga o no alguna prenda ese color todavía ("aunque no haya ninguna prenda con este color, que aparezcan como opción"). Más tarde el usuario también pidió sacar "Multicolor" de la paleta (quedaron 16) y un circulito de swatch al lado de cada nombre (`GARMENT_COLOR_HEX`, mismo patrón que el selector de `create-garment.tsx` — ver esa sección para el detalle completo del cambio a "Otro" con texto libre, que no aplica acá porque este filtro no necesita una opción "Otro": filtra sobre colores que ya existen en la DB, no crea contenido nuevo). El filtro en sí se sigue aplicando **client-side** después de traer los resultados (no con `.ilike()/.or()` de PostgREST): la tabla es chica, y comparar en JS evita armar/escapar a mano un string OR. El `.limit()` de la query de prendas quedó en 100 (subido de 30 el mismo día) para no truncar antes de ese filtro client-side.
  - Verificado en browser real (desktop y mobile 375px): chip "Todo" trae las 4 categorías mezcladas; ícono cambia `filtro_negro.png`↔`filtro_rosa.png` al togglear; seleccionar Negro+Gris en Color trae la unión de ambos (no la intersección); "Limpiar" resetea precio/orden/color/estilo sin tocar la categoría activa; en 375px de ancho los chips wrappean sin romper el layout; los 16 colores de la paleta con su swatch aparecen siempre en el panel (confirmado tocando "Rosa" — 0 prendas hoy con ese color — y viendo el chip activarse y el resultado "Sin resultados", en vez de no existir como opción). `tsc` sin errores nuevos (los de `constants/mockData.ts` son preexistentes, archivo sin uso real).
  - **Color/Estilo colapsados por default dentro del panel (2026-09-14, ajuste sobre lo de arriba, mismo día):** el usuario no quería ver los 16 colores + todos los estilos apenas tocaba el ícono de filtro. `colorSectionOpen`/`styleSectionOpen` (estado nuevo, `false` por default) — cada sección ahora tiene su propio header tocable (`collapsibleHeader`: label + chevron `⌄`/`⌃`) que expande/colapsa solo esa lista de chips; el label muestra un contador cuando hay filtros activos y la sección está colapsada (ej. "COLOR (1)"), así el usuario ve que hay un filtro aplicado sin tener que reabrir la lista. Se resetean a `false` al cambiar de tab, igual que el resto de los filtros de Prendas. Precio y Ordenar por siguen siempre visibles (no son colapsables, no era lo que se pidió). Verificado en browser real (desktop y 375px): panel abre con Color/Estilo colapsados; tocar "Color" expande los 16 swatches; elegir "Rojo" y colapsar de nuevo muestra "COLOR (1)"; el filtro sigue aplicado colapsado (resultado "Sin resultados" correcto, ninguna prenda es roja hoy). `tsc` limpio.

### Wardrobe (`app/(tabs)/wardrobe.tsx`)
Mismo tab/ruta para las dos audiencias; el componente rama según `profile.is_brand` (2026-08-07):

**Usuarios normales — `PersonalWardrobeView`**
- Usa `useWardrobe(session.user.id)` — datos de `prendas_armario`
- Auth gate: si no hay sesión, empty state con mensaje "Iniciá sesión para ver tu armario"
- **Header:** "Mi Armario" + contador de prendas
- **Filtro por slot:** horizontal `FlatList` con chips (Todo / Torso / Piernas / Calzado / Extras); filtra client-side sobre `item.slot`
- **Grid:** 3 columnas, `WardrobeCard` — imagen + nombre + marca; tap navega a `product/[id]`
- Empty state por slot: mensaje contextual diferenciado (armario vacío vs. slot sin prendas)
- Nota: el filtro depende de que `prendas_armario` tenga columna `slot`; si no existe, siempre muestra "Todo" sin romper

**Cuentas de marca (`profile.is_brand`) — `BrandCatalogView`**
- Reemplaza por completo la función de armario: una marca no tiene armario personal, tiene inventario propio.
- Resuelve la marca de la cuenta logueada con `useMyBrand(session.user.id)`, y reusa `useBrand(brand.id)` (mismo hook que `app/marca/[id].tsx`) para traer `garments` y `outfits`.
- **Header:** "Catálogo" + contador según la sub-tab activa.
- **Dos sub-tabs** (mismo patrón visual que `BRAND_TABS` de `app/marca/[id].tsx`, pero con label de texto en vez de ícono): **Prendas** y **Outfits**.
  - **Prendas:** grid de 3 columnas, `GarmentStockCard` — imagen + nombre + **stock total** (`Object.values(garment.stock_por_talle).reduce(sum)`), en rosa "Sin stock" si da 0. Tap navega a `product/[id]` (solo lectura — no hay pantalla de edición de prendas en esta app, eso vive en `opa-web`, sin iniciar).
  - **Outfits:** grid de 3 columnas con los outfits creados por esa marca (`creator_id = marcas.profile_id`, vía `useBrand`); si la marca no tiene `profile_id` o no publicó outfits, queda vacío (mismo gap conocido de `marca/[id].tsx`).
- **"Descontinuar" / "Reactivar" (2026-08-14):** único botón de escritura en esta pantalla — pill sobre la imagen de cada `GarmentStockCard`. Escribe `prendas.descontinuada` directo por Supabase (`supabase.from('prendas').update(...)`, no por la API — ver por qué en `database-2026-06-06-schema-and-seed.md` → `prendas` → nota de `descontinuada`) y llama `refetch()`. Card descontinuada: imagen atenuada (`opacity: 0.4`) + badge negro "Descontinuada", sin el texto de stock. Fuera de esto, sigue siendo solo lectura — no hay pantalla de edición de prendas en esta app, eso vive en `opa-web`, sin iniciar.

### Measurements (`app/measurements.tsx`)
Accessible from Settings → "Mis medidas" row.

- **5 numeric fields:** Altura (cm) · Pecho (cm) · Cintura (cm) · Cadera (cm) · Muslo (cm)
- Each field: `TextInput` with `keyboardType="decimal-pad"`, `maxLength=5`, strips non-numeric/non-dot chars on change
- Data loaded from `useUserMeasurements()` on mount; converts numbers to strings for display, empty string if null
- Save: converts string values back to `Number` (or `null` if empty) → calls `save(payload)` with UPSERT
- Success indicator: "Medidas guardadas ✓" text in `rosaOpa` shown after successful save
- Layout: `KeyboardAvoidingView` wrapper (`padding` on iOS), `ScrollView` content; fields inside a white card with `borderBottomWidth` separators

### User Profile (`app/user/[id].tsx`)
- Perfil de lectura de **otro usuario** (no marca separada — reusa el mismo layout para cualquier `perfiles` no propio). Antes de este screen, la app no tenía forma de ver el perfil de nadie más que uno mismo: tocar un creador saltaba directo al scroll de sus outfits.
- Param: `id` (userId). Si `id` === el usuario logueado, redirige a `/(tabs)/profile` (este screen es exclusivamente para perfiles ajenos).
- Top bar: flecha de volver (`flecha.png`) y compartir (`compartir.png`), ambos assets reales de Supabase Storage — **no** texto/emoji. El ícono de menú (`···`) sí quedó como texto porque no hay ningún asset de menú/opciones en el bucket `assets/` (se buscó explícitamente).
- Header: avatar + stats (Seguidores/Seguidos/Outfits — sin "Guardados", que es privado), nombre, handle, bio, ig, tags.
- Botón **Seguir/Siguiendo** con `useFollow` (mismo hook que el scroll de outfits, sin campanita de notificaciones — ver pendientes).
- Un solo tab (grid, sin favoritos/pedidos — esos son privados del dueño), **centrado** en la tab bar (no pegado a la izquierda), sección "Outfits creados", grid 3 columnas con like count, tap → `user-outfits.tsx` con `userId` + `startIndex`.
- Iconos de compartir y menú arriba a la derecha son solo visuales por ahora, sin acción — ver pendientes.
- **Bottom navbar standalone**: esta pantalla vive fuera del `Tabs` navigator (es un stack screen bajo `app/`), así que no puede reusar `components/navigation/BottomNavBar.tsx` directamente (ese componente depende de `state`/`navigation` de `@react-navigation/bottom-tabs`). Se armó una versión propia dentro del mismo archivo, calcada visualmente (mismos ícono paths en `assets/nav/`, mismo `iconWrap` con fondo rosa cuando activo), con "perfil" siempre marcado como activo y cada ícono navegando con `router.push` a la ruta del tab real (`/(tabs)`, `/(tabs)/outfits`, etc.). Si se agrega otra pantalla standalone que necesite esta navbar, vale la pena extraer esto a un componente compartido en vez de copiar el bloque de nuevo.
- Puntos de entrada actualizados para navegar acá en vez de saltar directo al scroll: fila de creador en `outfit/[id].tsx`, avatar/nombre del creador en `OutfitScrollItem` (scroll principal), y `@username` en resultados de `search.tsx`.

### Brand Profile (`app/marca/[id].tsx`)
Perfil público de una marca — layout distinto al de usuario (banner + avatar-logo circular, badge `verificado_ondas.png` si `marcas.verified`, `@handle · Marca`, bio, tags, stats Seguidores/Outfits/Prendas, tabs icon-only Grid/Catálogo). Hook `useBrand(marcaId)`.

- **Modo `isOwn`** (`brand.profile_id === session.user.id`, agregado 2026-07-13): engranaje de configuración (→ `/settings`) en vez de compartir/menú, sin botón "Seguir", tab "perfil" de la navbar activo. Es el layout que ve una cuenta de marca logueada de sí misma (ver Profile arriba).
- **Modo ajeno**: banner "Ya lo tenés" si el usuario logueado tiene prendas de esa marca en el armario (cruza `useWardrobe` con `garment.brand_id`), botón Seguir (full-width, como siempre). **El botón "Preguntar" que existió acá brevemente el 2026-09-07 se sacó el mismo día** — el usuario pidió el modelo Mercado Libre en su lugar (preguntar solo tiene sentido sobre una prenda puntual, no sobre la marca en general); el Q&A ahora vive únicamente en `app/product/[id].tsx`, ver esa sección.
- Igual que `app/user/[id].tsx`, vive fuera del `Tabs` navigator — bottom navbar standalone propia.
- **Limitación conocida:** todas las `marcas` menos Revés tienen `profile_id = NULL` (falta onboarding de cuentas de marca), así que Outfits/Seguidores quedan vacíos y Seguir es inerte para esas marcas; el catálogo sí trae datos reales siempre.
- **Prendas descontinuadas (2026-08-14):** el tab Catálogo filtra `garments` con `descontinuada = false` antes de renderizar (`visibleGarments`), incluso en modo `isOwn` — la gestión/reactivación no vive acá, vive en `app/(tabs)/wardrobe.tsx` → `BrandCatalogView`.
- **Bug de `useFollow('')` encontrado y arreglado (2026-08-14):** `useFollow(brand?.profile_id ?? '')` disparaba una query a `follows` con `following_id` vacío en el primer render de esta pantalla (antes de que `useBrand` termine de cargar `brand`), tirando un 400 en consola — inofensivo (nunca hay match, no rompe nada visualmente) pero ruidoso. Encontrado de casualidad mientras se investigaba un bug no relacionado (switcher multi-cuenta, ver `CLAUDE.md`). Fix: `hooks/useFollow.ts` ahora corta si `targetUserId` es falsy, antes de armar la query.

### Follow List (`app/followers/[id].tsx`) — nuevo 2026-09-07
Lista de seguidores/seguidos estilo Instagram/TikTok. Antes de esto los stats "Seguidores"/"Seguidos" en `profile.tsx`, `user/[id].tsx` y `marca/[id].tsx` eran texto plano, no tocable.

- Params: `id` (perfil cuyos seguidores/seguidos se listan), `type` (`'followers' | 'following'`, tab inicial).
- Standalone (fuera del `Tabs` navigator), sin bottom navbar — mismo patrón liviano que `user-outfits.tsx`/`saved-outfits.tsx`, no el patrón "perfil completo" de `user/[id].tsx`.
- Tabs Seguidores/Siguiendo — **ocultos** (solo lista de Seguidores) cuando `useProfile(id).profile.is_brand` es `true`, porque hoy no existe ningún mecanismo para que una marca siga a alguien.
- Buscador (`TextInput`) que filtra **client-side** sobre la lista ya cargada por `username`/`display_name` — no dispara una query nueva; con el volumen actual de follows esto alcanza (mismo criterio que el buscador de `search.tsx`).
- Hook `hooks/useFollowList.ts`: 2 queries (mismo patrón que `useFollowedBrandIds.ts`) — primero `follows` filtrado por `follower_id` o `following_id` según `type`, después `perfiles.in(ids)`. Si algún resultado es `is_brand`, un tercer paso resuelve `marcas.id` a partir de `profile_id` (necesario porque `follows` solo guarda el `profile_id`, y navegar a una marca requiere el id de la fila `marcas`, no el `profile_id`).
- Componente de fila `components/profile/FollowListRow.tsx`: avatar + username/nombre, botón Seguir/Siguiendo inline (usa `useFollow` por fila, con `e.stopPropagation()` para no disparar también la navegación de la fila al tocarlo) — oculto si la fila es el propio usuario logueado, o si el viewer es una cuenta de marca (mismo criterio `viewerIsBrand` que el resto de la app). Tocar el resto de la fila navega a `/marca/[id]` (si `is_brand` y se resolvió `brandId`) o `/user/[id]`.
- Conectado desde los 3 puntos existentes: `app/(tabs)/profile.tsx`, `app/user/[id].tsx` (stats "Seguidores"/"Seguidos"), y `app/marca/[id].tsx` (solo "Seguidores", y solo si `brand.profile_id` existe — sin onboarding no hay perfil al que navegar).
- Verificado en browser real con datos reales (no seed inventado): perfil de marca (Capas, 1 seguidor real) → lista sin botón Seguir (viewer marca) → tap navega a `/user/[id]` → su stat Seguidos (3) muestra la lista con tabs, incluye 2 marcas y 1 usuario, tap en una marca de la lista confirma que navega a `/marca/[id]` (resolución de `brandId` correcta). Con una cuenta de prueba no-marca: botón Seguir/Siguiendo hace INSERT/DELETE real en `follows`, contador se actualiza, no navega al tocarlo. Cuenta de prueba borrada al terminar.

### User Outfits (`app/user-outfits.tsx`)
- Scroll full-screen TikTok para los outfits de un perfil específico
- Parámetros: `userId`, `startIndex`
- Sin header flotante (no camión, no tabs, no botón +)
- Botón back circular translúcido (arriba izquierda)
- Navegar desde el grid del perfil propio o desde `app/user/[id].tsx`

### Saved Outfits (`app/saved-outfits.tsx`)
- Scroll full-screen TikTok para los outfits guardados en favoritos
- Parámetro: `startIndex` (usa `useAuthStore` para el userId)
- Mismo layout que `user-outfits.tsx`
- Navegar desde el sub-tab Favoritos > Outfits del perfil

### Auth (`app/auth/index.tsx`)
- Modal con `presentation: 'modal'`, `animation: 'slide_from_bottom'`
- Logo OPA (`logoOPA-transparente.png` desde Supabase Storage)
- Login / signup switcher — `switchMode()` limpia todos los errores y campos
- Login: email + password → `supabase.auth.signInWithPassword`
- Signup: username + email + password → `supabase.auth.signUp`
- **Validación por campo en tiempo real:**
  - Username: regex `/^[a-z0-9._]+$/` — error si tiene mayúsculas, espacios o caracteres especiales
  - Email: regex básico de formato
  - Password: mínimo 6 caracteres
  - Login: banner de error sobre el botón si credenciales inválidas
- Botón bloqueado si hay errores activos
- Borde rojo (`inputError` style) en campos inválidos

### Settings (`app/settings.tsx`)
Accessible from the ⚙ icon in Profile. Requires active session.

**Implemented ✅**
- Header with back button
- Profile card: avatar + username + "Ver mi perfil" link
- Section list: CUENTA · PREFERENCIAS · APLICACIÓN (UI only — no screens behind items yet)
- **Cerrar sesión**: calls `supabase.auth.signOut()` + clears Zustand store → redirects to `/(tabs)`
- **Eliminar cuenta**: modal with password confirmation
  - Button disabled until password is typed
  - Verifies password via `supabase.auth.signInWithPassword`
  - Error in red below input if password is wrong
  - Calls `supabase.rpc('delete_user')` on success → signOut → redirect
  - Spinner during verification and deletion

**Also implemented ✅**
- **Mis medidas** row in PREFERENCIAS section → navigates to `app/measurements.tsx`
- **Registrar Marca** row — shown only when `perfiles.is_brand = false`. Opens a modal with fields: Nombre de marca (free text), Instagram (free text), Categoría (free text varchar, no constraint). On submit: inserts into `brand_applications` table with `profile_id`, `brand_name`, `instagram_handle`, `category`. Modal state vars: `showBrandModal`, `brandName`, `brandInstagram`, `brandCategory`, `brandError`, `brandLoading`.

Settings sub-screens (editar perfil, seguridad, notificaciones, preferencias de estilo, etc.) are tracked in `meta-2026-06-10-pending-features.md` — not duplicated here.

---

## Components

### Navigation
**`components/navigation/BottomNavBar.tsx`**
- 5 flat equal tabs: Home · Outfits · Search · Wardrobe · Profile
- PNG icons from Supabase Storage (`assets/nav/`)
- All tabs are the same size — no elevated center button
- Active tab: `rosaOpaLight` background on `48×48` icon container (`borderRadius: 8`) + `_rosa.png` icon variant
- Inactive tab: no background, default icon
- Thin gray top border (`grisBorde`)
- `paddingBottom` via `useSafeAreaInsets().bottom` (not hardcoded)
- No text labels
- Registered in `app/(tabs)/_layout.tsx` as `tabBar={(props) => <BottomNavBar {...props} />}`
- **Ícono condicional del tab Wardrobe (2026-08-07):** lee `profile.is_brand` de `useAuthStore`. Si es una cuenta de marca, el tab `wardrobe` muestra `assets/bag_negra.png` / `bag_rosa.png` (mismos assets que el tab "Catálogo" de `app/marca/[id].tsx`) en vez de `assets/nav/armario.png` / `armario_rosa.png` — la ruta sigue siendo `wardrobe`, solo cambia el ícono; el contenido detrás lo resuelve `app/(tabs)/wardrobe.tsx` (ver sección Wardrobe más arriba).

> `BottomTabBar.tsx` still exists but is unused (logic stripped). `BottomNavBar.tsx` is the active component.

### Home
- **`SectionHeader`**: UPPERCASE bold title (Merge One) + clickable pink arrow →
- **`HorizontalSlider`**: generic horizontal `ScrollView` wrapper
- **`BrandsSlider`**: brand-specific slider

### Outfit
- **`OutfitScrollItem`**: full item for the vertical feed
- **`OutfitCard`**: outfit card for the carousel
- **`OutfitGarmentLabel`**: floating chip with circular thumbnail + name + price
- **`OutfitBottomBar`**: white bottom panel with total price + "View outfit" button

### Profile
- **`ProfileHeader`**: avatar + username + name + bio + tags
- **`ProfileStats`**: stats row
- **`ProfileNavbar`**: internal Grid/Favorites/Orders tabs with active indicator
- **`OutfitGrid`**: 3-column outfit grid

### UI Primitives
- **`Button`**: primary/secondary button with variants
- **`Tag`**: style chip with border
- **`Avatar`**: circular image with fallback to initial letter
- **`Badge`**: numeric indicator

---

## Design Tokens

Defined in `constants/`:

```ts
// colors.ts
rosaOpa: '#EB006B'
rosaOpaLight: 'rgba(235, 0, 107, 0.2)'
negro: '#000000'
blanco: '#FFFFFF'
grisClaro: '#838383'
grisBorde: '#F2F2F2'
grisMedio: '#D9D9D9'
grisOscuro: '#4E4E4E'
bordeTag: '#A6A6AC'

// fonts.ts
mergeOne: 'MergeOne-Regular'      // Section titles and headings
palanquinDark: 'PalanquinDark'    // Buttons, usernames

// radius.ts
card: 15, chip: 10, button: 8, tag: 8, avatar: 9999

// spacing.ts
xs:4, sm:8, md:12, lg:16, xl:24, xxl:32
```

**Merge One font:** file `assets/fonts/MergeOne-Regular.ttf` loaded with `expo-font` in `_layout.tsx`.

---

## Relevant Technical Configuration

- `newArchEnabled: false` in `app.json` — incompatible with react-native-screens@4.16.0 on RN 0.81.5; do not change to `true` until upgrading to RN ≥ 0.82
- `"updates": { "enabled": false }` in `app.json` — prevents Expo Go from downloading the remote bundle instead of the local dev server
- `--legacy-peer-deps` required for all `npm install` — peer dependency conflicts between Expo SDK 54 packages
- `pointerEvents` as a style prop (not a direct prop) in RN 0.71+
- `babel.config.js` and `metro.config.js` are mandatory — Metro cannot compile the project without them
- **`components/layout/MobileFrame.tsx`** (2026-07-06): en web, si la ventana es más ancha que un teléfono, encuadra la app en una columna centrada de 393px (`APP_MAX_WIDTH`, iPhone 16 Pro) sobre fondo gris; en móvil/Chrome responsive angosto no se aplica. Wrapper en `app/_layout.tsx` envolviendo el `<Stack>`.
- **`constants/layout.ts`** (`APP_WIDTH`): todos los cálculos de layout basados en ancho (carruseles, grillas, cards) usan `APP_WIDTH` en vez de `Dimensions.get('window').width`, para que el layout se calcule contra el ancho del "teléfono" y no del monitor. La altura sigue usando `Dimensions.get('window').height` directo. Son constantes a nivel de módulo — no se recalculan en un resize en vivo, solo en cada carga.

---

## Pending

> All pending frontend items are tracked in `meta-2026-06-10-pending-features.md`. Do not add new pending items here.
