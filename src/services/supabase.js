import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zbowizpdsekljkudfjgx.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpib3dpenBkc2VrbGprdWRmamd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMzQ2NTksImV4cCI6MjA4NjgxMDY1OX0.YaJDKg6arHwbkVCr1qZc9aDK2jrxxFv3SiRpqxGFKLY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================
// Events CRUD Operations
// ============================

/**
 * Convertit un objet event du format app vers le format Supabase (snake_case)
 */
function toSupabaseEvent(eventData) {
    // S'assurer que la date est au format ISO complet pour Supabase
    let dateValue = eventData.eventDate || eventData.date || null
    if (dateValue && dateValue.length === 16) {
        // Format datetime-local (YYYY-MM-DDTHH:MM) → ajouter :00 pour les secondes
        dateValue = dateValue + ':00'
    }
    const lat = eventData.latitude ?? eventData.coords?.lat ?? null
    const lng = eventData.longitude ?? eventData.coords?.lng ?? null
    const mediaType = eventData.mediaType || eventData.type || 'image'
    const mediaUrl = eventData.mediaUrl || eventData.image || null
    const locationName = eventData.locationName || eventData.location || null
    const district = eventData.district ?? eventData.quartier ?? ''
    const city = eventData.city ?? eventData.ville ?? ''
    const tags = eventData.tags || eventData.features || []
    const defaultStatus = eventData.status ?? (eventData.createdBy ? 'pending' : 'approved')

    const mapped = {
        title: eventData.title,
        description: eventData.description || null,
        date: dateValue,
        event_date: dateValue,
        end_date: eventData.endDate || null,
        location: locationName,
        location_name: locationName,
        address: eventData.address || null,
        city: city || null,
        district: district || null,
        organizer: eventData.organizer || eventData.organizerName || null,
        organizer_name: eventData.organizerName || eventData.organizer || null,
        organizer_phone: eventData.organizerPhone || null,
        organizer_id: eventData.organizerId || null,
        image: mediaUrl,
        media_url: mediaUrl,
        media_type: mediaType === 'image' ? 'image' : 'video',
        coords_lat: lat,
        coords_lng: lng,
        latitude: lat,
        longitude: lng,
        distance: eventData.distance || null,
        participant_count: eventData.participantCount ?? 0,
        is_registered: eventData.isRegistered ?? false,
        is_premium: eventData.isPremium ?? false,
        price: eventData.price ?? 0,
        capacity: eventData.capacity ?? eventData.ticketCapacity ?? null,
        features: tags,
        type: mediaType,
        background_music: eventData.backgroundMusic || eventData.musicUrl || null,
        music_url: eventData.musicUrl || eventData.backgroundMusic || null,
        music_title: eventData.musicTitle || null,
        promo_text: eventData.promoText || null,
        tags,
        status: defaultStatus,
        is_featured: eventData.isFeatured ?? false,
        is_ticketing_enabled: eventData.isTicketingEnabled ?? eventData.ticketingEnabled ?? false,
        view_count: eventData.viewCount ?? 0,
        click_count: eventData.clickCount ?? 0
    }
    // video_url : ajouté conditionnellement (la colonne peut ne pas encore exister)
    if (eventData.videoUrl) mapped.video_url = eventData.videoUrl
    if (eventData.createdBy !== undefined) {
        mapped.created_by = eventData.createdBy
        mapped.created_by_profile = eventData.createdBy
    }
    if (eventData.createdByProfile !== undefined) mapped.created_by_profile = eventData.createdByProfile
    // Modération : status et motif de rejet
    if (eventData.rejectionReason !== undefined) mapped.rejection_reason = eventData.rejectionReason
    if (eventData.approvedBy !== undefined) mapped.approved_by = eventData.approvedBy
    if (eventData.approvedAt !== undefined) mapped.approved_at = eventData.approvedAt
    // Phase 1/2 : géo + tags + quartier
    mapped.quartier = district || null
    mapped.ville = city || null
    // Phase 3 : billetterie
    if (eventData.ticketingEnabled !== undefined) mapped.ticketing_enabled = eventData.ticketingEnabled
    if (eventData.isTicketingEnabled !== undefined) mapped.ticketing_enabled = eventData.isTicketingEnabled
    if (eventData.ticketPrice !== undefined) mapped.ticket_price = eventData.ticketPrice
    if (eventData.ticketCapacity !== undefined) mapped.ticket_capacity = eventData.ticketCapacity
    if (eventData.commissionRate !== undefined) mapped.commission_rate = eventData.commissionRate
    return mapped
}

function toLegacySupabaseEvent(eventData) {
    const mapped = toSupabaseEvent(eventData)
    const legacyKeys = [
        'title', 'description', 'date', 'location', 'organizer', 'image',
        'coords_lat', 'coords_lng', 'distance', 'participant_count',
        'is_registered', 'is_premium', 'price', 'features', 'type',
        'background_music', 'music_title', 'promo_text', 'video_url',
        'status', 'rejection_reason', 'quartier', 'ville', 'tags',
        'ticketing_enabled', 'ticket_price', 'ticket_capacity', 'commission_rate'
    ]
    const legacy = {}
    legacyKeys.forEach((key) => {
        if (mapped[key] !== undefined) legacy[key] = mapped[key]
    })
    if (Number.isInteger(eventData.createdBy)) legacy.created_by = eventData.createdBy
    return legacy
}

/**
 * Convertit un event Supabase (snake_case) vers le format app (camelCase)
 */
function fromSupabaseEvent(row) {
    const date = row.event_date || row.date
    const location = row.location_name || row.location || ''
    const mediaUrl = row.media_url || row.image || ''
    const mediaType = row.type || row.media_type || 'image'
    const city = row.city || row.ville || ''
    const district = row.district || row.quartier || ''
    const tags = row.tags || row.features || []
    return {
        id: row.id,
        title: row.title,
        description: row.description || '',
        date,
        eventDate: date,
        endDate: row.end_date || null,
        location,
        locationName: location,
        address: row.address || '',
        city,
        district,
        quartier: district,
        ville: city,
        organizer: row.organizer_name || row.organizer || '',
        organizerName: row.organizer_name || row.organizer || '',
        organizerPhone: row.organizer_phone || '',
        organizerId: row.organizer_id || null,
        image: mediaUrl,
        mediaUrl,
        coords: {
            lat: row.latitude ?? row.coords_lat,
            lng: row.longitude ?? row.coords_lng
        },
        distance: row.distance || '0 km',
        participantCount: row.participant_count || 0,
        isRegistered: row.is_registered || false,
        isPremium: row.is_premium || false,
        price: row.price || 0,
        capacity: row.capacity || null,
        features: tags,
        tags,
        type: mediaType,
        mediaType,
        videoUrl: row.video_url || '',
        backgroundMusic: row.music_url || row.background_music || '',
        musicUrl: row.music_url || row.background_music || '',
        musicTitle: row.music_title || '',
        promoText: row.promo_text || '',
        createdBy: row.created_by_profile || row.created_by || null,
        createdByProfile: row.created_by_profile || null,
        createdAt: row.created_at,
        status: row.status || 'approved',
        rejectionReason: row.rejection_reason || '',
        isFeatured: row.is_featured || false,
        ticketingEnabled: row.is_ticketing_enabled ?? row.ticketing_enabled ?? false,
        isTicketingEnabled: row.is_ticketing_enabled ?? row.ticketing_enabled ?? false,
        ticketPrice: row.ticket_price || 0,
        ticketCapacity: row.capacity || row.ticket_capacity || null,
        commissionRate: row.commission_rate || 5,
        viewCount: row.view_count || 0,
        clickCount: row.click_count || 0,
        approvedBy: row.approved_by || null,
        approvedAt: row.approved_at || null
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

    // Retry with the legacy schema when the Babivibes columns are not migrated yet.
    if (error) {
        console.warn('createEvent retry legacy payload:', error.message)
        const mappedWithoutVideo = toLegacySupabaseEvent(eventData)
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

    // Retry with the legacy schema when the Babivibes columns are not migrated yet.
    if (error) {
        console.warn('updateEvent retry legacy payload:', error.message)
        const mappedWithoutVideo = toLegacySupabaseEvent(updates)
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

    let { data, error } = await supabase
        .from('events')
        .insert(mapped)
        .select()

    if (error) {
        const legacy = eventsArray.map(toLegacySupabaseEvent)
        const retry = await supabase
            .from('events')
            .insert(legacy)
            .select()
        data = retry.data
        error = retry.error
    }

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
        emoji: '',
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
        emoji: '',
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
        emoji: '',
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
    { id: 'orange_money', name: 'Orange Money', emoji: '', color: 'bg-orange-500' },
    { id: 'mtn_momo', name: 'MTN MoMo', emoji: '', color: 'bg-yellow-500' },
    { id: 'wave', name: 'Wave', emoji: '', color: 'bg-blue-500' },
    { id: 'card', name: 'Carte bancaire', emoji: '', color: 'bg-gray-600' }
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
    if (userData.pseudo !== undefined) user.pseudo = userData.pseudo
    if (userData.spaceName !== undefined) user.space_name = userData.spaceName
    if (userData.organizerName !== undefined) user.organizer_name = userData.organizerName
    return user
}

/**
 * Convertit un user Supabase (snake_case) vers le format app (camelCase)
 */
function fromSupabaseUser(row) {
    // role_v2 (enum: consumer|organizer|admin) prend le pas si présent
    const effectiveRole = row.role_v2 || row.role || 'consumer'
    return {
        id: row.id,
        name: row.name,
        pseudo: row.pseudo || row.name,
        phone: row.phone,
        email: row.email || '',
        avatar: row.avatar || null,
        following: row.following || [],
        role: effectiveRole === 'user' ? 'consumer' : effectiveRole,
        spaceName: row.space_name || null,
        organizerName: row.organizer_name || null,
        createdAt: row.created_at
    }
}

function toSupabaseProfile(userData) {
    const role = userData.role === 'user' || !userData.role ? 'consumer' : userData.role
    return {
        role,
        full_name: userData.name || userData.fullName || userData.pseudo || null,
        pseudo: userData.pseudo || userData.name || null,
        phone: userData.phone,
        email: userData.email || null,
        city: userData.city || null,
        district: userData.district || null,
        latitude: userData.latitude ?? userData.coords?.lat ?? null,
        longitude: userData.longitude ?? userData.coords?.lng ?? null,
        consent_data: userData.consentData ?? userData.consent_data ?? false
    }
}

function fromSupabaseProfile(row) {
    return {
        id: row.id,
        userId: row.user_id || null,
        name: row.full_name || row.pseudo,
        fullName: row.full_name || '',
        pseudo: row.pseudo || row.full_name,
        phone: row.phone,
        email: row.email || '',
        avatar: null,
        following: [],
        role: row.role || 'consumer',
        city: row.city || '',
        district: row.district || '',
        latitude: row.latitude ?? null,
        longitude: row.longitude ?? null,
        consentData: row.consent_data || false,
        spaceName: row.full_name || row.pseudo || null,
        organizerName: row.full_name || row.pseudo || null,
        createdAt: row.created_at
    }
}

/**
 * Rechercher un utilisateur par numéro de téléphone
 */
export async function findUserByPhone(phone) {
    try {
        const profile = await supabase
            .from('profiles')
            .select('*')
            .eq('phone', phone)
            .maybeSingle()

        if (!profile.error) {
            return profile.data ? fromSupabaseProfile(profile.data) : null
        }
        if (profile.error.code !== '42P01') {
            console.warn('findProfileByPhone:', profile.error.message)
        }
    } catch (err) {
        console.warn('findProfileByPhone:', err.message)
    }

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
    try {
        const profilePayload = toSupabaseProfile(userData)
        const profile = await supabase
            .from('profiles')
            .insert(profilePayload)
            .select()
            .single()

        if (!profile.error) {
            return fromSupabaseProfile(profile.data)
        }
        if (profile.error.code !== '42P01') {
            console.warn('createProfile:', profile.error.message)
        }
    } catch (err) {
        console.warn('createProfile:', err.message)
    }

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
    try {
        const profileMapped = {}
        if (updates.name !== undefined) profileMapped.full_name = updates.name
        if (updates.fullName !== undefined) profileMapped.full_name = updates.fullName
        if (updates.pseudo !== undefined) profileMapped.pseudo = updates.pseudo
        if (updates.phone !== undefined) profileMapped.phone = updates.phone
        if (updates.email !== undefined) profileMapped.email = updates.email || null
        if (updates.role !== undefined) profileMapped.role = updates.role === 'user' ? 'consumer' : updates.role
        if (updates.city !== undefined) profileMapped.city = updates.city || null
        if (updates.district !== undefined) profileMapped.district = updates.district || null
        if (updates.latitude !== undefined) profileMapped.latitude = updates.latitude
        if (updates.longitude !== undefined) profileMapped.longitude = updates.longitude
        if (updates.consentData !== undefined) profileMapped.consent_data = updates.consentData
        if (Object.keys(profileMapped).length) {
            profileMapped.updated_at = new Date().toISOString()
            const profile = await supabase
                .from('profiles')
                .update(profileMapped)
                .eq('id', id)
                .select()
                .single()

            if (!profile.error) {
                return fromSupabaseProfile(profile.data)
            }
            if (profile.error.code !== '42P01') {
                console.warn('updateProfile:', profile.error.message)
            }
        }
    } catch (err) {
        console.warn('updateProfile:', err.message)
    }

    // Ne mapper que les champs fournis
    const mapped = {}
    if (updates.name !== undefined) mapped.name = updates.name
    if (updates.pseudo !== undefined) mapped.pseudo = updates.pseudo
    if (updates.phone !== undefined) mapped.phone = updates.phone
    if (updates.email !== undefined) mapped.email = updates.email
    if (updates.avatar !== undefined) mapped.avatar = updates.avatar
    if (updates.following !== undefined) mapped.following = updates.following
    if (updates.role !== undefined) {
        mapped.role = updates.role
        mapped.role_v2 = updates.role === 'user' ? 'consumer' : updates.role
    }
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
    try {
        const profiles = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

        if (!profiles.error && profiles.data?.length) {
            return profiles.data.map(fromSupabaseProfile)
        }
        if (profiles.error && profiles.error.code !== '42P01') {
            console.warn('fetchProfiles:', profiles.error.message)
        }
    } catch (err) {
        console.warn('fetchProfiles:', err.message)
    }

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
        image: row.media_url || row.image || '',
        mediaUrl: row.media_url || row.image || '',
        mediaType: row.media_type || (row.video_url ? 'video' : 'image'),
        link: row.destination_url || row.link || '#',
        sponsor: row.advertiser_name || row.sponsor,
        advertiserName: row.advertiser_name || row.sponsor || '',
        sponsorLogo: row.sponsor_logo || null,
        ctaText: row.cta_text || 'En savoir plus',
        isActive: row.is_active ?? true,
        startDate: row.start_date,
        endDate: row.end_date,
        clickCount: row.click_count || 0,
        viewCount: row.view_count || 0,
        position: row.position || 0,
        createdBy: row.created_by || null,
        createdAt: row.created_at,
        format: row.format || 'banner',
        targetQuartier: row.target_quartier || null,
        targetCity: row.target_city || null,
        targetDistrict: row.target_district || row.target_quartier || null,
        targetEventTags: row.target_event_tags || [],
        targetPdv: row.target_pdv || null,
        videoUrl: row.video_url || null,
        advertiserId: row.advertiser_id || null
    }
}

function toSupabaseAd(adData) {
    const mapped = {}
    if (adData.title !== undefined) mapped.title = adData.title
    if (adData.description !== undefined) mapped.description = adData.description
    if (adData.image !== undefined) mapped.image = adData.image
    if (adData.mediaUrl !== undefined) mapped.media_url = adData.mediaUrl
    if (adData.mediaType !== undefined) mapped.media_type = adData.mediaType
    if (adData.link !== undefined) mapped.link = adData.link
    if (adData.destinationUrl !== undefined) mapped.destination_url = adData.destinationUrl
    if (adData.sponsor !== undefined) mapped.sponsor = adData.sponsor
    if (adData.advertiserName !== undefined) mapped.advertiser_name = adData.advertiserName
    if (adData.sponsorLogo !== undefined) mapped.sponsor_logo = adData.sponsorLogo
    if (adData.ctaText !== undefined) mapped.cta_text = adData.ctaText
    if (adData.isActive !== undefined) mapped.is_active = adData.isActive
    if (adData.startDate !== undefined) mapped.start_date = adData.startDate
    if (adData.endDate !== undefined) mapped.end_date = adData.endDate
    if (adData.position !== undefined) mapped.position = adData.position
    if (adData.createdBy !== undefined) mapped.created_by = adData.createdBy
    // Phase 3 extensions
    if (adData.format !== undefined) mapped.format = adData.format
    if (adData.targetQuartier !== undefined) mapped.target_quartier = adData.targetQuartier
    if (adData.targetCity !== undefined) mapped.target_city = adData.targetCity
    if (adData.targetDistrict !== undefined) mapped.target_district = adData.targetDistrict
    if (adData.targetEventTags !== undefined) mapped.target_event_tags = adData.targetEventTags
    if (adData.targetPdv !== undefined) mapped.target_pdv = adData.targetPdv
    if (adData.videoUrl !== undefined) mapped.video_url = adData.videoUrl
    if (adData.advertiserId !== undefined) mapped.advertiser_id = adData.advertiserId
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
