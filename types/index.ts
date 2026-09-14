// Types aligned to the real Supabase schema (tables in Spanish)

// ─── Core entities ───────────────────────────────────────────────────────────

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
  stock_por_talle: Record<string, number> | null
  descontinuada: boolean
  created_at: string
  brand?: Brand
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

// prendas_armario — user's personal wardrobe (simplified schema)
export interface WardrobeItem {
  id: string
  user_id: string
  garment_id: string
  added_at: string
  size: string | null
  color: string | null
  source: string | null
  garment?: Garment
}

// ─── Social & commerce ───────────────────────────────────────────────────────

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

export interface SavedOutfit {
  user_id: string
  outfit_id: string
  created_at: string
  outfit?: Outfit
}

export interface CartItem {
  id: string
  user_id: string
  garment_id: string
  quantity: number
  created_at: string
  garment?: Garment
}

export interface Order {
  id: string
  user_id: string
  total: number
  status: string
  created_at: string
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  garment_id: string
  quantity: number
  price: number
  garment?: Garment
}

export interface Review {
  id: string
  user_id: string
  garment_id: string
  rating: number
  comment: string | null
  created_at: string
}

// preguntas — Q&A entre un usuario y una marca (sobre una prenda puntual, o la
// marca en general si garment_id es null). answer/answered_at null = sin responder.
export interface Question {
  id: string
  user_id: string
  brand_id: string
  garment_id: string | null
  question: string
  answer: string | null
  answered_at: string | null
  created_at: string
  user?: { username: string; avatar_url: string | null } | null
  garment?: { name: string } | null
}

// notificaciones — alimentada por triggers de DB (follow/like/save/preguntas),
// no por el cliente. `actor_id` es quien generó el evento (nullable: no aplica
// a `question_answered`, ahí lo relevante es la marca vía `garment`/`pregunta`).
export type NotificationType = 'follow' | 'like' | 'save' | 'question_asked' | 'question_answered'

export interface AppNotification {
  id: string
  recipient_id: string
  actor_id: string | null
  type: NotificationType
  outfit_id: string | null
  garment_id: string | null
  pregunta_id: string | null
  read: boolean
  created_at: string
  actor?: { id: string; username: string; display_name: string | null; avatar_url: string | null; is_brand: boolean } | null
  outfit?: { id: string; title: string | null; cover_image_url: string | null } | null
  garment?: { id: string; name: string; brand_id: string } | null
}

// ─── Size guide system ────────────────────────────────────────────────────────

export interface SizeGuide {
  id: string
  name: string
  category: 'tops' | 'bottoms'
  fit_type: 'oversize' | 'boxy' | 'relaxed' | 'baggy' | 'straight' | 'skinny'
  brand_id: string | null
  created_at: string
}

export interface SizeGuideEntry {
  id: string
  guide_id: string
  size_label: string
  chest_min: number | null
  chest_max: number | null
  waist_min: number | null
  waist_max: number | null
  hip_min: number | null
  hip_max: number | null
  height_min: number | null
  height_max: number | null
  thigh_min: number | null
  thigh_max: number | null
  rise_min: number | null
  rise_max: number | null
  sort_order: number
}

export interface UserMeasurements {
  id: string
  user_id: string
  chest: number | null
  waist: number | null
  hip: number | null
  height: number | null
  thigh: number | null
  foot_length: number | null
  updated_at: string
}
