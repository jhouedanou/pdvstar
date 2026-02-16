import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zbowizpdsekljkudfjgx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpib3dpenBkc2VrbGprdWRmamd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzQ2NTksImV4cCI6MjA4NjgxMDY1OX0.YaJDKg6arHwbkVCr1qZc9aDK2jrxxFv3SiRpqxGFKLY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================
// Events CRUD Operations
// ============================

/**
 * Convertit un objet event du format app vers le format Supabase (snake_case)
 */
function toSupabaseEvent(eventData) {
    // S'assurer que la date est au format ISO complet pour Supabase
    let dateValue = eventData.date || null
    if (dateValue && dateValue.length === 16) {
        // Format datetime-local (YYYY-MM-DDTHH:MM) → ajouter :00 pour les secondes
        dateValue = dateValue + ':00'
    }
    const mapped = {
        title: eventData.title,
        description: eventData.description || null,
        date: dateValue,
        location: eventData.location || null,
        organizer: eventData.organizer || null,
        image: eventData.image || null,
        coords_lat: eventData.coords?.lat ?? null,
        coords_lng: eventData.coords?.lng ?? null,
        distance: eventData.distance || null,
        participant_count: eventData.participantCount ?? 0,
        is_registered: eventData.isRegistered ?? false,
        is_premium: eventData.isPremium ?? false,
        price: eventData.price ?? 0,
        features: eventData.features || [],
        type: eventData.type || 'image',
        background_music: eventData.backgroundMusic || null,
        music_title: eventData.musicTitle || null,
        promo_text: eventData.promoText || null
    }
    if (eventData.createdBy !== undefined) mapped.created_by = eventData.createdBy
    return mapped
}

/**
 * Convertit un event Supabase (snake_case) vers le format app (camelCase)
 */
function fromSupabaseEvent(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description || '',
        date: row.date,
        location: row.location || '',
        organizer: row.organizer || '',
        image: row.image || '',
        coords: {
            lat: row.coords_lat,
            lng: row.coords_lng
        },
        distance: row.distance || '0 km',
        participantCount: row.participant_count || 0,
        isRegistered: row.is_registered || false,
        isPremium: row.is_premium || false,
        price: row.price || 0,
        features: row.features || [],
        type: row.type || 'image',
        backgroundMusic: row.background_music || '',
        musicTitle: row.music_title || '',
        promoText: row.promo_text || '',
        createdBy: row.created_by || null,
        createdAt: row.created_at
    }
}

/**
 * Récupérer tous les événements, triés par date de création décroissante
 */
export async function fetchEvents() {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Erreur fetchEvents:', error.message)
        return []
    }

    return data.map(fromSupabaseEvent)
}

/**
 * Créer un nouvel événement
 */
export async function createEvent(eventData) {
    const mapped = toSupabaseEvent(eventData)

    const { data, error } = await supabase
        .from('events')
        .insert(mapped)
        .select()
        .single()

    if (error) {
        console.error('❌ Erreur createEvent:', error.message)
        return null
    }

    return fromSupabaseEvent(data)
}

/**
 * Mettre à jour un événement existant
 */
export async function updateEvent(id, updates) {
    const mapped = toSupabaseEvent(updates)

    const { data, error } = await supabase
        .from('events')
        .update(mapped)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('❌ Erreur updateEvent:', error.message)
        return null
    }

    return fromSupabaseEvent(data)
}

/**
 * Supprimer un événement
 */
export async function deleteEvent(id) {
    const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('❌ Erreur deleteEvent:', error.message)
        return false
    }

    return true
}

/**
 * Insérer les données seed dans Supabase (pour initialisation)
 */
export async function seedEvents(eventsArray) {
    const mapped = eventsArray.map(toSupabaseEvent)

    const { data, error } = await supabase
        .from('events')
        .insert(mapped)
        .select()

    if (error) {
        console.error('❌ Erreur seedEvents:', error.message)
        return []
    }

    return data.map(fromSupabaseEvent)
}

// ============================
// Users CRUD Operations
// ============================

/**
 * Convertit un objet user du format app vers le format Supabase (snake_case)
 */
function toSupabaseUser(userData) {
    const user = {
        name: userData.name,
        phone: userData.phone,
        email: userData.email || '',
        avatar: userData.avatar || null,
        following: userData.following || [],
        role: userData.role || 'user'
    }
    if (userData.spaceName !== undefined) user.space_name = userData.spaceName
    if (userData.organizerName !== undefined) user.organizer_name = userData.organizerName
    return user
}

/**
 * Convertit un user Supabase (snake_case) vers le format app (camelCase)
 */
function fromSupabaseUser(row) {
    return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email || '',
        avatar: row.avatar || null,
        following: row.following || [],
        role: row.role || 'user',
        spaceName: row.space_name || null,
        organizerName: row.organizer_name || null,
        createdAt: row.created_at
    }
}

/**
 * Rechercher un utilisateur par numéro de téléphone
 */
export async function findUserByPhone(phone) {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phone)
        .maybeSingle()

    if (error) {
        console.error('❌ Erreur findUserByPhone:', error.message)
        return null
    }

    return data ? fromSupabaseUser(data) : null
}

/**
 * Créer un nouvel utilisateur
 */
export async function createUser(userData) {
    const mapped = toSupabaseUser(userData)

    const { data, error } = await supabase
        .from('users')
        .insert(mapped)
        .select()
        .single()

    if (error) {
        console.error('❌ Erreur createUser:', error.message)
        return null
    }

    return fromSupabaseUser(data)
}

/**
 * Mettre à jour un utilisateur existant
 */
export async function updateUser(id, updates) {
    // Ne mapper que les champs fournis
    const mapped = {}
    if (updates.name !== undefined) mapped.name = updates.name
    if (updates.phone !== undefined) mapped.phone = updates.phone
    if (updates.email !== undefined) mapped.email = updates.email
    if (updates.avatar !== undefined) mapped.avatar = updates.avatar
    if (updates.following !== undefined) mapped.following = updates.following
    if (updates.role !== undefined) mapped.role = updates.role
    if (updates.spaceName !== undefined) mapped.space_name = updates.spaceName
    if (updates.organizerName !== undefined) mapped.organizer_name = updates.organizerName

    const { data, error } = await supabase
        .from('users')
        .update(mapped)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('❌ Erreur updateUser:', error.message)
        return null
    }

    return fromSupabaseUser(data)
}

/**
 * Récupérer tous les utilisateurs
 */
export async function fetchUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Erreur fetchUsers:', error.message)
        return []
    }

    return data.map(fromSupabaseUser)
}

// ============================
// Ads CRUD Operations
// ============================

function fromSupabaseAd(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description || '',
        image: row.image || '',
        link: row.link || '#',
        sponsor: row.sponsor,
        sponsorLogo: row.sponsor_logo || null,
        ctaText: row.cta_text || 'En savoir plus',
        isActive: row.is_active ?? true,
        startDate: row.start_date,
        endDate: row.end_date,
        clickCount: row.click_count || 0,
        viewCount: row.view_count || 0,
        position: row.position || 0,
        createdBy: row.created_by || null,
        createdAt: row.created_at
    }
}

function toSupabaseAd(adData) {
    const mapped = {}
    if (adData.title !== undefined) mapped.title = adData.title
    if (adData.description !== undefined) mapped.description = adData.description
    if (adData.image !== undefined) mapped.image = adData.image
    if (adData.link !== undefined) mapped.link = adData.link
    if (adData.sponsor !== undefined) mapped.sponsor = adData.sponsor
    if (adData.sponsorLogo !== undefined) mapped.sponsor_logo = adData.sponsorLogo
    if (adData.ctaText !== undefined) mapped.cta_text = adData.ctaText
    if (adData.isActive !== undefined) mapped.is_active = adData.isActive
    if (adData.startDate !== undefined) mapped.start_date = adData.startDate
    if (adData.endDate !== undefined) mapped.end_date = adData.endDate
    if (adData.position !== undefined) mapped.position = adData.position
    if (adData.createdBy !== undefined) mapped.created_by = adData.createdBy
    return mapped
}

export async function fetchAds() {
    const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('position', { ascending: true })

    if (error) {
        console.error('\u274c Erreur fetchAds:', error.message)
        return []
    }
    return data.map(fromSupabaseAd)
}

export async function fetchActiveAds() {
    const { data, error } = await supabase
        .from('ads')
        .select('*')
        .eq('is_active', true)
        .order('position', { ascending: true })

    if (error) {
        console.error('\u274c Erreur fetchActiveAds:', error.message)
        return []
    }
    return data.map(fromSupabaseAd)
}

export async function createAd(adData) {
    const mapped = toSupabaseAd(adData)
    const { data, error } = await supabase
        .from('ads')
        .insert(mapped)
        .select()
        .single()

    if (error) {
        console.error('\u274c Erreur createAd:', error.message)
        return null
    }
    return fromSupabaseAd(data)
}

export async function updateAd(id, updates) {
    const mapped = toSupabaseAd(updates)
    const { data, error } = await supabase
        .from('ads')
        .update(mapped)
        .eq('id', id)
        .select()
        .single()

    if (error) {
        console.error('\u274c Erreur updateAd:', error.message)
        return null
    }
    return fromSupabaseAd(data)
}

export async function deleteAd(id) {
    const { error } = await supabase
        .from('ads')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('\u274c Erreur deleteAd:', error.message)
        return false
    }
    return true
}

export async function incrementAdClick(id) {
    const { error } = await supabase.rpc('increment_ad_click', { ad_id: id }).catch(() => {
        // Fallback: direct update
        return supabase.from('ads').update({ click_count: supabase.raw('click_count + 1') }).eq('id', id)
    })
    // Simple fallback
    await supabase
        .from('ads')
        .select('click_count')
        .eq('id', id)
        .single()
        .then(async ({ data }) => {
            if (data) {
                await supabase.from('ads').update({ click_count: (data.click_count || 0) + 1 }).eq('id', id)
            }
        })
}
