# Auditoría de código — 2026-09-14

Auditoría completa de `main` a pedido del usuario ("encontrá todas las malas prácticas, malas optimizaciones y cosas que podrían estar más organizadas"), cubriendo `app/`, `components/`, `hooks/`, `lib/`, `store/`, `types/`, `constants/` y config de raíz. Se dividió en dos categorías: **tareas de respuesta única** (sin ambigüedad de producto/arquitectura — se implementaron directo) y **tareas que requieren una decisión** (más de un camino razonable, o cambian comportamiento visible). Regla usada para clasificar: si arreglarlo bien implica elegir entre UX/alcance/riesgo, va a "requiere decisión"; si es mecánico, reversible y no cambia ningún comportamiento (o corrige uno roto a su versión obviamente correcta), va a "respuesta única".

---

## ✅ Parte A — Respuesta única (ya implementadas)

### Bugs reales corregidos
- [x] **Filtro de categorías del armario personal no funcionaba** — `app/(tabs)/wardrobe.tsx` filtraba con `(item as any).slot`, un campo que no existe ni en el tipo `WardrobeItem` ni en los datos reales (la categoría vive en `item.garment.category`). Cualquier chip que no fuera "Todo" mostraba lista vacía siempre. Corregido a `item.garment?.category === activeSlot`.
- [x] **Swatch de color de `app/product/[id].tsx` usaba un mapa stale** — `colorToHex()` tenía su propio `Record` hardcodeado con colores (`cognac`, `mostaza`, `oliva`, `camel`, `crema`) que la migración de estandarización de paleta (documentada en `CLAUDE.md`, 2026-09-14) ya sacó de la DB. Reemplazado por `GARMENT_COLOR_HEX` de `constants/garmentColors.ts` — una sola fuente de verdad para la paleta, en vez de dos mapas que podían divergir.

### Consolidación de duplicación (constantes nuevas)
- [x] **`constants/garmentCategories.ts`** — nuevo, exporta `GARMENT_CATEGORIES` (torso/piernas/calzado/extras). Antes estaba redefinido de forma independiente en 4 archivos (`app/outfit/[id].tsx`, `app/(tabs)/wardrobe.tsx`, `app/(tabs)/search.tsx`, `app/brand/create-garment.tsx`) — ahora los 4 importan la misma constante (los que necesitan un chip "Todo"/"Todos" lo agregan ellos mismos con su propia key, sin tocar el comportamiento existente).
- [x] **`constants/storage.ts`** — nuevo, exporta `STORAGE_BASE_URL`. Antes la URL base de Supabase Storage estaba hardcodeada de forma independiente en 16 archivos, con nombres distintos (`STORAGE`, `BASE`, `ASSETS_BASE`) y a veces con/sin barra final. Consolidada en un solo lugar — verificado que ningún archivo la sigue hardcodeando suelta, y que las URLs resultantes son byte-idénticas a las de antes (mismo dominio, mismo path, sin cambios visibles).

### Limpieza mecánica (sin cambio de comportamiento)
- [x] Sacados los imports de `Dimensions` sin usar (residuo de un refactor anterior a `useAppWidth()`/`useWindowDimensions()`) en `app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx`, `app/user/[id].tsx`, `app/marca/[id].tsx`.
- [x] Sacado el import de `Link` sin usar en `app/outfit/[id].tsx`.
- [x] Sacado el import de `spacing` sin usar en `components/outfit/OutfitScrollItem.tsx`.
- [x] Tipado `onViewableItemsChanged` con `ViewToken[]` de `react-native` en vez de `any`, en `app/(tabs)/outfits.tsx`, `app/user-outfits.tsx`, `app/saved-outfits.tsx`.
- [x] Hoisteado `viewabilityConfig` a una constante de módulo en `app/(tabs)/outfits.tsx` (antes era un objeto literal inline, nuevo en cada render — React Native pide explícitamente que sea una referencia estable).
- [x] Agregado guard contra doble-invocación en `hooks/useCart.ts` (`addItem`), mismo patrón que ya usan `useLike`/`useFollow` — evita que un doble-tap en "Agregar al carrito" dispare dos inserts en paralelo.
- [x] **`useAuthStore` migrado a selectores en los 21 call sites que lo usaban sin uno** (`const { x } = useAuthStore()` → `const x = useAuthStore(s => s.x)`) — evita que cada componente se re-renderice en cualquier cambio del store completo (incluido cada `TOKEN_REFRESHED` periódico de Supabase) cuando solo necesita un campo puntual.
- [x] Agregado `accessibilityLabel`/`accessibilityRole` a controles solo-ícono que no tenían ninguno: botones de like/guardar/compartir del outfit scroll (`OutfitScrollItem.tsx`), flecha "ver más" (`SectionHeader.tsx`), botón cerrar del zoom (`ZoomableImage.tsx`), y los 5 tabs de `BottomNavBar.tsx`. Cambio puramente aditivo, sin tocar estilos ni tamaños.
- [x] **Cast innecesario `(item as any).creator` en `app/(tabs)/search.tsx` — NO se sacó.** Al remover el cast aparece un error real de TypeScript (`possibly 'undefined'`) porque `Outfit.creator` es opcional y el JSX no lo estaba narrowing correctamente en ese punto. Se dejó el cast original tal cual estaba (no se fuerza una solución apurada) — ver Parte B si se quiere resolver bien.

**Verificación:** `npx tsc --noEmit` sin errores nuevos (los únicos que quedan son los 23 preexistentes de `constants/mockData.ts`, un archivo ya identificado como código muerto — ver Parte B). Probado en el preview real: Home carga con datos reales de Supabase a través de la nueva `STORAGE_BASE_URL` sin diferencias visuales.

---

## 🟡 Parte B — Requieren una decisión tuya

### ✅ B0. Borrado de código muerto confirmado — RESUELTO (2026-09-14)

El modo automático de Claude Code bloqueó el primer intento por ser una "destrucción local irreversible" — el usuario confirmó explícitamente y se borraron los 12 archivos (0 referencias reales confirmadas con grep desde `app/`, `components/`, `hooks/`):

- `constants/mockData.ts`, `store/useOutfitStore.ts`, `store/useWardrobeStore.ts`, `App.tsx`
- `components/navigation/BottomTabBar.tsx`, `components/outfit/OutfitBottomBar.tsx`, `components/outfit/OutfitGarmentLabel.tsx`, `components/profile/OutfitGrid.tsx`, `components/profile/ProfileHeader.tsx`, `components/profile/ProfileNavbar.tsx`, `components/profile/ProfileStats.tsx`, `components/ui/Button.tsx`

**Hallazgo adicional durante el borrado:** al sacar `App.tsx`, `npx tsc --noEmit` reveló que `index.ts` (raíz) también estaba roto — era el mismo boilerplate de antes de Expo Router (`registerRootComponent(App)`, importaba `./App` directo), sin ningún otro archivo que lo referenciara (`package.json` usa `"main": "expo-router/entry"`, no `index.ts`). Se borró también.

**Verificado:** `npx tsc --noEmit` sale 100% limpio (0 errores, ni siquiera los que tenía `mockData.ts` antes). Probado en el preview real — Home carga sin diferencias.

### ✅ B1. `components/ui/Avatar.tsx` — RESUELTO (2026-09-14): opción 1, adoptado

El usuario eligió adoptar `Avatar.tsx` en vez de borrarlo. Al investigar aparecieron **7 lugares** con el patrón (no 6 como se estimó al principio): `app/(tabs)/profile.tsx`, `app/user/[id].tsx`, `app/settings.tsx`, `app/switch-account.tsx`, `app/marca/[id].tsx`, `app/outfit/[id].tsx` (avatar del creador del outfit) y `app/(tabs)/index.tsx` (avatar de marca en el header de `BrandHomeView`) — más `components/profile/FollowListRow.tsx`, que tenía el mismo patrón duplicado también.

**Hallazgo importante antes de tocar nada:** el `Avatar.tsx` original caía a un ícono genérico (`assets/icon.png`) cuando no había foto — pero las 8 pantallas reales mostraban un **círculo de color con la inicial del nombre**, cada una con su propia combinación de tamaño/color/fuente (ej. `profile.tsx`: 80px rosa clarito + texto rosa; `settings.tsx`: 52px rosa sólido + texto blanco; `outfit/[id].tsx`: 32px gris + texto gris, sin fuente Merge One). Adoptar el componente tal cual habría sido una regresión visual real, no solo un refactor. Se reescribió `Avatar.tsx` para aceptar `label` (calcula la inicial) + props opcionales de color/tamaño/fuente del fallback, así cada pantalla preserva su apariencia exacta y solo se comparte el código de la rama "imagen vs. inicial".

`Tag.tsx` quedó sin resolver — nadie lo usa todavía (no se encontró un caso real de "tags junto al avatar" al revisar los 8 sitios). Sigue pendiente de decisión aparte si hace falta en el futuro.

**Verificado:** `tsc --noEmit` limpio. Probado en browser real logueado como Capas — fallback rosa con "C" en Settings y en "Cambiar de cuenta" (círculo dashed "+" de agregar cuenta intacto, no se tocó), avatar-logo con anillo blanco en el perfil propio de marca, logo real en el header de la Home de marca — sin ninguna diferencia visual respecto a antes.

### B2. `components/ui/Badge.tsx` — ¿mantener para el pendiente de "badge de descuento" o borrar?

Cero referencias hoy, pero `CLAUDE.md` documenta un pendiente ("Badge de descuento — X% OFF" en la barra de precio del outfit scroll) que necesitaría exactamente un componente así el día que se agregue `discount_percent` a la DB.

**Opciones:** mantenerlo a la espera de esa feature, o borrarlo ahora y rehacerlo si/cuando se implemente el descuento.

### B3. `components/home/BrandsSlider.tsx` + `HorizontalSlider.tsx` — ¿conectar o borrar?

`BrandsSlider` fue construido específicamente para la sección "Las Marcas que la Gente Elige" del Home, pero esa sección la reimplementa a mano en `app/(tabs)/index.tsx` en su lugar — ninguno de los dos componentes tiene consumidores reales hoy. `HorizontalSlider` es el wrapper genérico que además resolvería los ~6 `ScrollView horizontal` inline que tiene duplicados el Home.

**Opciones:**
1. Conectar `BrandsSlider`/`HorizontalSlider` reemplazando el código inline del Home (arregla la duplicación real).
2. Borrar ambos y dejar el Home como está.

### B4. Refactors grandes de duplicación de pantallas (bajo riesgo, pero tocan mucha superficie)

- Unificar `app/user-outfits.tsx` y `app/saved-outfits.tsx` (casi copias exactas) en un componente compartido.
- Unificar la navbar standalone duplicada al 100% entre `app/user/[id].tsx` y `app/marca/[id].tsx`.
- Extraer la función `initials()` (copiada 3 veces) a `lib/text.ts`.

**Decisión:** ¿lo hago ahora (uno, varios, o todos) o lo dejamos para una sesión aparte dedicada a esto? Cada uno es un cambio autocontenido, puedo hacerlos de a uno.

### B5. `useSupabaseQuery` genérico — el cambio de mayor impacto, pero el más grande

~15 hooks repiten casi el mismo patrón `data/loading/error` con `useEffect` + `try/finally`, y ~19 de 21 hooks de lectura descartan el `error` de Supabase en silencio (un fallo real de red/RLS se ve igual que "no hay datos"). Un hook genérico compartido resolvería ambas cosas de un saque.

**Por qué es "decisión" y no "respuesta única":** además de la extracción en sí (mecánica), hay que decidir **qué hacer con el `error` una vez que se empiece a exponer** — ¿se agrega una UI de error en cada pantalla que lo consuma (cambio de UX visible), o se deja solo disponible para debug sin mostrar nada todavía? Y por el volumen (~15 archivos tocados), prefiero encarar esto como una tarea aparte en vez de mezclarlo con el resto.

**Opciones:** (a) hacerlo ahora como una tarea dedicada, (b) hacerlo hook por hook empezando por los más críticos (`useBrand`, `useCart`), (c) dejarlo documentado como pendiente para más adelante.

### B6. Manejo de errores en escrituras optimistas de `useCart`

`updateQuantity`/`removeItem` actualizan el estado local antes de confirmar la escritura y nunca revierten si falla (RLS/red) — el ítem queda "sacado" en pantalla aunque siga en la DB. Arreglarlo bien implica decidir qué feedback darle al usuario si falla (¿toast de error? ¿reintentar solo? ¿revertir en silencio?) — es una decisión de UX, no solo de código.

### B7. Dependencias de `package.json` sin uso directo confirmado

`nativewind`, `tailwindcss` (no hay `tailwind.config`), `expo-linking` (el código usa `Linking` de `react-native` core), `expo-constants`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets` (probable remanente de una versión descartada del zoom con `PanResponder`), `react-native-is-edge-to-edge` (ya es transitiva), `@types/react-native` (deprecado desde RN 0.71+). `babel-preset-expo` está en `dependencies` cuando debería ser `devDependency`.

**Por qué es "decisión" y no "respuesta única":** tocar `package.json` está explícitamente marcado como una acción que requiere confirmación previa en mis reglas de seguridad — sacar una dependencia nativa sin uso *directo* en JS (como `reanimated`/`gesture-handler`) puede romper algo a nivel de config nativo que un simple `grep` no detecta, así que además de tu OK hace falta reinstalar (`npm install --legacy-peer-deps`) y volver a probar la app entera, no solo correr `tsc`.

**Decisión:** ¿querés que lo intente (con verificación completa después) o lo dejamos como está?

### B8. Tamaños de touch target < 44×44 e iconografía "volver" inconsistente

- Los botones de like/save/compartir del outfit scroll miden 34×34 (por debajo del mínimo recomendado de accesibilidad). Agrandarlos es un cambio visual, no solo de código.
- 6 pantallas (`app/outfit/[id].tsx`, `app/settings.tsx`, `app/measurements.tsx`, `app/switch-account.tsx`, `app/user-outfits.tsx`, `app/saved-outfits.tsx`) siguen con el glifo de texto `←` en vez del asset real `flecha.png` que ya usan 8 pantallas — el criterio ("usar el asset real, no texto") ya está establecido en `CLAUDE.md`, así que esto casi no tiene ambigüedad, pero al ser un cambio visible en 6 pantallas preferí confirmarlo antes de tocarlas todas de una.

**Decisión:** ¿aplico el reemplazo de ícono en las 6 pantallas ahora? ¿Agrando los botones de acción a 44×44?

---

## Resumen para retomar

- **Bucket A: 100% implementado y verificado** (tsc limpio, probado en preview).
- **B0: resuelto** (12 archivos borrados + `index.ts` huérfano encontrado de yapa).
- **B1–B8: pendientes**, se van revisando de a uno en el chat con el usuario (decisión tomada 2026-09-14: "repasémoslas una por una", no todas de una).
