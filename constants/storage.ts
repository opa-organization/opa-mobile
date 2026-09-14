// URL base de Supabase Storage para el bucket `assets` — antes estaba
// hardcodeada de forma independiente (con nombres distintos: STORAGE, BASE,
// ASSETS_BASE) en ~16 archivos. Unificada acá para que no puedan divergir.
// Sin barra final: los consumidores agregan `/` + el nombre del archivo.
export const STORAGE_BASE_URL = 'https://vecnktrbjolahcalkbml.supabase.co/storage/v1/object/public/assets'
