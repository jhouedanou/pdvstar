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
        type: eventData.mediaType || eventData.type || 'image',
        background_music: eventData.backgroundMusic || null,
        music_title: eventData.musicTitle || null,
        promo_text: eventData.promoText || null
    }
    // video_url : ajouté conditionnellement (la colonne peut ne pas encore exister)
    if (eventData.videoUrl) mapped.video_url = eventData.videoUrl
    if (eventData.createdBy !== undefined) mapped.created_by = eventData.createdBy
    // Modération : status et motif de rejet
    if (eventData.status !== undefined) mapped.status = eventData.status
    if (eventData.rejectionReason !== undefined) mapped.rejection_reason = eventData.rejectionReason
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
        mediaType: row.type || 'image',
        videoUrl: row.video_url || '',
        backgroundMusic: row.background_music || '',
        musicTitle: row.music_title || '',
        promoText: row.promo_text || '',
        createdBy: row.created_by || null,
        createdAt: row.created_at,
        status: row.status || 'approved',
        rejectionReason: row.rejection_reason || ''
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

    let { data, error } = await supabase
        .from('events')
        .insert(mapped)
        .select()
        .single()

    // Si erreur (ex: colonne video_url inexistante), retry sans video_url
    if (error && mapped.video_url !== undefined) {
        console.warn('⚠️ createEvent retry sans video_url:', error.message)
        const { video_url, ...mappedWithoutVideo } = mapped
        const retry = await supabase
            .from('events')
            .insert(mappedWithoutVideo)
            .select()
            .single()
        data = retry.data
        error = retry.error
    }

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

    let { data, error } = await supabase
        .from('events')
        .update(mapped)
        .eq('id', id)
        .select()
        .single()

    // Si erreur (ex: colonne video_url inexistante), retry sans video_url
    if (error && mapped.video_url !== undefined) {
        console.warn('⚠️ updateEvent retry sans video_url:', error.message)
        const { video_url, ...mappedWithoutVideo } = mapped
        const retry = await supabase
            .from('events')
            .update(mappedWithoutVideo)
            .eq('id', id)
            .select()
            .single()
        data = retry.data
        error = retry.error
    }

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
// Passes d'Accès (Tarification)
// ============================

/**
 * Catalogue des passes disponibles
 */
export const PASS_CATALOG = {
    decouverte: {
        id: 'decouverte',
        name: 'Découverte',
        emoji: '🎟️',
        price: 5000,
        currency: 'CFA',
        durationDays: 3,
        description: 'Accès illimité pendant 3 jours',
        features: ['Accès aux événements premium', 'Contenu exclusif 3 jours', 'Badge Découverte'],
        color: 'from-blue-500 to-cyan-400'
    },
    standard: {
        id: 'standard',
        name: 'Standard',
        emoji: '⭐',
        price: 15000,
        currency: 'CFA',
        durationDays: 30,
        description: 'Accès complet pendant 1 mois',
        features: ['Accès aux événements premium', 'Contenu exclusif 1 mois', 'Badge Standard', 'Priorité notifications'],
        color: 'from-purple-500 to-pink-500',
        popular: true
    },
    premium: {
        id: 'premium',
        name: 'Premium',
        emoji: '👑',
        price: 30000,
        currency: 'CFA',
        durationDays: 30,
        description: 'Accès VIP pendant 1 mois',
        features: ['Accès illimité tous événements', 'Contenu VIP exclusif', 'Badge Premium Or', 'Priorité notifications', 'Support prioritaire', 'Pas de publicités'],
        color: 'from-yellow-500 to-orange-500'
    }
}

/**
 * Méthodes de paiement supportées
 */
export const PAYMENT_METHODS = [
    { id: 'orange_money', name: 'Orange Money', emoji: '🟠', color: 'bg-orange-500' },
    { id: 'mtn_momo', name: 'MTN MoMo', emoji: '🟡', color: 'bg-yellow-500' },
    { id: 'wave', name: 'Wave', emoji: '🔵', color: 'bg-blue-500' },
    { id: 'card', name: 'Carte bancaire', emoji: '💳', color: 'bg-gray-600' }
]

function fromSupabasePass(row) {
    return {
        id: row.id,
        userId: row.user_id,
        passType: row.pass_type,
        purchasedAt: row.purchased_at,
        expiresAt: row.expires_at,
        paymentMethod: row.payment_method || null,
        paymentRef: row.payment_ref || null,
        status: row.status || 'active',
        createdAt: row.created_at
    }
}

/**
 * Acheter / activer un pass pour un utilisateur
 */
export async function purchasePass(userId, passType, paymentMethod, paymentRef) {
    const passDef = PASS_CATALOG[passType]
    if (!passDef) throw new Error('Type de pass invalide: ' + passType)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + passDef.durationDays * 24 * 60 * 60 * 1000)

    const mapped = {
        user_id: userId,
        pass_type: passType,
        purchased_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_method: paymentMethod,
        payment_ref: paymentRef || null,
        status: 'active'
    }

    try {
        const { data, error } = await supabase
            .from('user_passes')
            .insert(mapped)
            .select()
            .single()

        if (error) {
            console.error('❌ Erreur purchasePass:', error.message)
            // Fallback: stocker localement
            return {
                id: 'local_' + Date.now(),
                ...mapped,
                userId: mapped.user_id,
                passType: mapped.pass_type,
                purchasedAt: mapped.purchased_at,
                expiresAt: mapped.expires_at,
                paymentMethod: mapped.payment_method,
                paymentRef: mapped.payment_ref
            }
        }
        return fromSupabasePass(data)
    } catch (err) {
        console.error('❌ Erreur réseau purchasePass:', err)
        return {
            id: 'local_' + Date.now(),
            userId,
            passType,
            purchasedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
            paymentMethod,
            paymentRef,
            status: 'active'
        }
    }
}

/**
 * Récupérer le pass actif d'un utilisateur
 */
export async function getActivePass(userId) {
    try {
        const { data, error } = await supabase
            .from('user_passes')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .gte('expires_at', new Date().toISOString())
            .order('expires_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (error) {
            console.error('❌ Erreur getActivePass:', error.message)
            return null
        }
        return data ? fromSupabasePass(data) : null
    } catch (err) {
        console.error('❌ Erreur réseau getActivePass:', err)
        return null
    }
}

/**
 * Récupérer l'historique des passes d'un utilisateur
 */
export async function getUserPasses(userId) {
    try {
        const { data, error } = await supabase
            .from('user_passes')
            .select('*')
            .eq('user_id', userId)
            .order('purchased_at', { ascending: false })

        if (error) {
            console.error('❌ Erreur getUserPasses:', error.message)
            return []
        }
        return data.map(fromSupabasePass)
    } catch (err) {
        console.error('❌ Erreur réseau getUserPasses:', err)
        return []
    }
}

/**
 * Admin : récupérer tous les passes (stats)
 */
export async function fetchAllPasses() {
    try {
        const { data, error } = await supabase
            .from('user_passes')
            .select('*')
            .order('purchased_at', { ascending: false })

        if (error) {
            console.error('❌ Erreur fetchAllPasses:', error.message)
            return []
        }
        return data.map(fromSupabasePass)
    } catch (err) {
        console.error('❌ Erreur réseau fetchAllPasses:', err)
        return []
    }
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
