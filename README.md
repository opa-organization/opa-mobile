# OPA Mobile

App mobile de descubrimiento de moda centrada en outfits como unidad principal de contenido. Experiencia visual e inmersiva estilo TikTok/Pinterest aplicada a la moda.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | React Native + Expo SDK 54 (managed workflow) |
| Navegación | Expo Router v6 (file-based routing) |
| Estado global | Zustand |
| Estilos | NativeWind (Tailwind para React Native) |
| Imágenes | Expo Image |
| Animaciones | React Native Reanimated v4 |
| Backend | Supabase (Project ID: `vecnktrbjolahcalkbml`) |
| Lenguaje | TypeScript |

## TP 10 — React Hook Form (Proyecto Final)

El formulario utilizado para este TP es el de **registro de usuario**, componente [`AuthScreen`](app/auth/index.tsx) (mismo componente que maneja login, en el modo "Registrate"). Se adaptó a React Hook Form sin agregar campos nuevos (usuario, nombre, email, contraseña) más un checkbox de términos y condiciones que no existía.

**Cómo está organizado** (separación de responsabilidades + comunicación entre componentes):

| Componente/hook | Responsabilidad |
|---|---|
| [`app/auth/index.tsx`](app/auth/index.tsx) (`AuthScreen`) | Componente **contenedor/padre**. Administra el formulario con `useForm` (`control`, `handleSubmit`, `formState.errors`, `reset`, `setError`) y decide qué hacer con los datos ya validados: llama a `useRegistration()` y navega si el resultado es exitoso. |
| [`components/auth/AuthFormFields.tsx`](components/auth/AuthFormFields.tsx) | Componente **hijo, presentacional**. Recibe `control`/`errors`/`mode` como props y renderiza los inputs vía `Controller` de React Hook Form — no tiene ningún `useState` propio para los datos del formulario, así que no duplica el estado que ya administra el padre. |
| [`hooks/useRegistration.ts`](hooks/useRegistration.ts) | Lógica de **backend** (Supabase `signInWithPassword`/`signUp`), sin tocar — se sigue llamando recién después de que React Hook Form aprobó las validaciones del lado del cliente. |

**Validaciones implementadas con React Hook Form** (todas se ejecutan antes de llamar a Supabase):

- Email: obligatorio + formato válido (regex)
- Usuario: obligatorio + mínimo 3 caracteres + caracteres permitidos (regex) — solo aplica en modo registro
- Contraseña: obligatoria + mínimo 8 caracteres (el mínimo de 8 solo se exige al registrarse, no al loguearse, para no romper cuentas seed ya existentes con passwords más cortas)
- Términos y condiciones: checkbox obligatorio (`validate`) — solo en modo registro

Los errores de backend que ya existían (usuario/email duplicado, credenciales incorrectas) se siguen mostrando igual, pero ahora vía `setError()` de React Hook Form en vez de `useState` manual.

## Setup

### 1. Clonar e instalar

```bash
git clone https://github.com/MaxiBernardoni/opa-mobile.git
cd opa-mobile
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` es obligatorio en todos los `npm install`. Hay conflictos de peer deps entre varias dependencias de Expo SDK 54.

### 2. Variables de entorno

Crear el archivo `.env` en la raíz del proyecto:

```
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

La anon key se obtiene desde el dashboard de Supabase → Project Settings → API.

### 3. Fuente Merge One (opcional)

La fuente `Merge One` no se puede instalar via npm. Para activarla:

1. Descargá `MergeOne-Regular.ttf` desde [Google Fonts](https://fonts.google.com/specimen/Merge+One)
2. Colocá el archivo en `assets/fonts/MergeOne-Regular.ttf`
3. En `app/_layout.tsx`, descomentá la línea:
```ts
MergeOne_400Regular: require('../assets/fonts/MergeOne-Regular.ttf'),
```

Sin este paso la app funciona igual usando fuentes del sistema.

### 4. Arrancar

**Web (recomendado — funciona en cualquier red):**
```bash
npx expo start --web --clear
```

**Celular con Expo Go (misma red WiFi que la PC):**
```bash
npx expo start --clear
```
Escaneá el QR con Expo Go. Requiere la versión de Expo Go compatible con SDK 54.

> **Redes corporativas:** Si Expo Go no puede descargar el runtime de SDK 54 por restricciones de red, usá el modo web o actualizá Expo Go usando datos móviles del teléfono.

## Estructura del proyecto

```
opa/
├── app/                    # Expo Router — rutas file-based
│   ├── (tabs)/             # Tab navigator
│   │   ├── index.tsx       # Home
│   │   ├── outfits.tsx     # Outfit Scroll (TikTok-style)
│   │   ├── search.tsx      # Búsqueda
│   │   ├── wardrobe.tsx    # Armario
│   │   └── profile.tsx     # Perfil
│   ├── outfit/[id].tsx     # Detalle de outfit
│   ├── product/[id].tsx    # Detalle de prenda
│   └── _layout.tsx         # Root layout + carga de fuentes
├── components/
│   ├── navigation/         # BottomTabBar custom
│   ├── outfit/             # OutfitCard, OutfitScrollItem
│   └── home/               # SectionHeader
├── constants/
│   ├── colors.ts           # Paleta OPA
│   ├── fonts.ts            # Referencias de fuentes
│   ├── spacing.ts          # Escala de espaciado
│   ├── radius.ts           # Border radii
│   └── mockData.ts         # Data de prueba (no requiere Supabase)
├── hooks/                  # useOutfits, useProfile, useWardrobe
├── lib/supabase.ts         # Cliente Supabase
├── store/                  # Zustand stores (auth, outfits, wardrobe)
├── types/index.ts          # Tipos globales TypeScript
├── babel.config.js         # Config de Babel — requerido por Metro
└── metro.config.js         # Config de Metro — requerido para bundling
```

## Estado actual — Demo 1

- [x] Setup del proyecto y configuración base
- [x] Design tokens (colores, tipografías, spacing, radius)
- [x] BottomTabBar custom con tab OPA destacado
- [x] Home screen con carousels horizontales
- [x] Outfit Scroll screen (full-screen, paginado vertical)
- [x] Profile screen con grid de outfits
- [x] Data mock (5 outfits, 5 marcas, 5 prendas)
- [x] Soporte web (`npx expo start --web`)

## Pendientes

- [ ] Añadir fuente Merge One (ver instrucciones arriba)
- [ ] Completar `.env` con la anon key de Supabase
- [ ] Aplicar migraciones de Supabase (schemas en CLAUDE.md)
- [ ] Reemplazar mock data por queries reales a Supabase
- [ ] Pantallas de detalle: outfit/[id] y product/[id]
- [ ] Pantalla de búsqueda
- [ ] Pantalla de armario con lógica real
