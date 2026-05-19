import { supabase } from './supabase'

/**
 * Phase 3 — Régie publicitaire
 * Formats: banner | fullscreen | video | story
 * Targeting: quartier, pdv
 * Tracking: via RPC track_ad (atomique view/click)
 */

function fromSupabaseAd(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description || '',
        image: row.image || '',
        videoUrl: row.video_url || '',
        link: row.link || '#',
        sponsor: row.sponsor,
        sponsorLogo: row.sponsor_logo || null,
        ctaText: row.cta_text || 'En savoir plus',
        isActive: row.is_active ?? true,
        format: row.format || 'banner',
        targetQuartier: row.target_quartier || null,
        targetPdv: row.target_pdv || null,
        advertiserId: row.advertiser_id || null,
        organizerId: row.organizer_id || null,
        eventId: row.event_id || null,
        targetCity: row.target_city || null,
        startDate: row.start_date,
        endDate: row.end_date,
        status: row.status || 'approved',
        rejectionReason: row.rejection_reason || null,
        approvedBy: row.approved_by || null,
        approvedAt: row.approved_at || null,
        clickCount: row.click_count || 0,
        viewCount: row.view_count || 0,
        position: row.position || 0,
        createdBy: row.created_by || null,
        createdAt: row.created_at
    }
}

function toSupabaseAd(d) {
    const m = {}
    if (d.title !== undefined) m.title = d.title
    if (d.description !== undefined) m.description = d.description
    if (d.image !== undefined) m.image = d.image
    if (d.videoUrl !== undefined) m.video_url = d.videoUrl
    if (d.link !== undefined) m.link = d.link
    if (d.sponsor !== undefined) m.sponsor = d.sponsor
    if (d.sponsorLogo !== undefined) m.sponsor_logo = d.sponsorLogo
    if (d.ctaText !== undefined) m.cta_text = d.ctaText
    if (d.isActive !== undefined) m.is_active = d.isActive
    if (d.format !== undefined) m.format = d.format
    if (d.targetQuartier !== undefined) m.target_quartier = d.targetQuartier
    if (d.targetPdv !== undefined) m.target_pdv = d.targetPdv
    if (d.advertiserId !== undefined) m.advertiser_id = d.advertiserId
    if (d.organizerId !== undefined) m.organizer_id = d.organizerId
    if (d.eventId !== undefined) m.event_id = d.eventId
    if (d.targetCity !== undefined) m.target_city = d.targetCity
    if (d.startDate !== undefined) m.start_date = d.startDate
    if (d.endDate !== undefined) m.end_date = d.endDate
    if (d.position !== undefined) m.position = d.position
    if (d.status !== undefined) m.status = d.status
    if (d.rejectionReason !== undefined) m.rejection_reason = d.rejectionReason
    if (d.approvedBy !== undefined) m.approved_by = d.approvedBy
    if (d.approvedAt !== undefined) m.approved_at = d.approvedAt
    if (d.createdBy !== undefined) m.created_by = d.createdBy
    return m
}

export async function fetchAdsForUser({ quartier = null, pdv = null } = {}) {
    let q = supabase.from('ads').select('*').eq('is_active', true).order('position', { ascending: true })
    const { data, error } = await q
    if (error) {
        console.error(' fetchAdsForUser:', error.message)
        return []
    }
    // Filtrage targeting côté client (simple, peu de pubs)
    return data
        .map(fromSupabaseAd)
        .filter(a => !a.targetQuartier || !quartier || a.targetQuartier === quartier)
        .filter(a => !a.targetPdv || !pdv || a.targetPdv === pdv)
}

export async function createAdvert(adData) {
    const { data, error } = await supabase.from('ads').insert(toSupabaseAd(adData)).select().single()
    if (error) {
        console.error(' createAdvert:', error.message)
        return null
    }
    return fromSupabaseAd(data)
}

export async function updateAdvert(id, updates) {
    const { data, error } = await supabase.from('ads').update(toSupabaseAd(updates)).eq('id', id).select().single()
    if (error) {
        console.error(' updateAdvert:', error.message)
        return null
    }
    return fromSupabaseAd(data)
}

export async function toggleAdActive(id, isActive) {
    return updateAdvert(id, { isActive })
}

/** Approbation admin : passe la pub en status 'approved' */
export async function approveAdvert(id, adminId) {
    return updateAdvert(id, {
        status: 'approved',
        isActive: true,
        approvedBy: adminId,
        approvedAt: new Date().toISOString()
    })
}

/** Rejet admin : passe la pub en status 'rejected' avec motif obligatoire */
export async function rejectAdvert(id, reason) {
    if (!reason?.trim()) throw new Error('Le motif de rejet est obligatoire')
    return updateAdvert(id, { status: 'rejected', isActive: false, rejectionReason: reason.trim() })
}

/** Archive une pub (admin) */
export async function archiveAdvert(id) {
    return updateAdvert(id, { status: 'archived', isActive: false })
}

/** Récupérer uniquement les pubs d'un organisateur (par createdBy) */
export async function fetchAdsByOrganizer(organizerUserId) {
    const { data, error } = await supabase
        .from('ads')
        .select('*')
        .eq('created_by', organizerUserId)
        .order('created_at', { ascending: false })
    if (error) {
        console.error(' fetchAdsByOrganizer:', error.message)
        return []
    }
    return data.map(fromSupabaseAd)
}

/** Récupérer toutes les pubs (admin) avec filtre status optionnel */
export async function fetchAllAds(statusFilter = null) {
    let q = supabase.from('ads').select('*').order('created_at', { ascending: false })
    if (statusFilter) q = q.eq('status', statusFilter)
    const { data, error } = await q
    if (error) {
        console.error(' fetchAllAds:', error.message)
        return []
    }
    return data.map(fromSupabaseAd)
}

export async function trackAd({ adId, type = 'view', userId = null, quartier = null }) {
    const { error } = await supabase.rpc('track_ad', {
        ad: adId, etype: type, uid: userId, q: quartier
    })
    if (error) console.warn('️ trackAd RPC échoué:', error.message)
}

export async function fetchAdvertiserStats(advertiserId) {
    const { data, error } = await supabase
        .from('ads')
        .select('id, title, view_count, click_count, is_active')
        .eq('advertiser_id', advertiserId)
    if (error) {
        console.error(' fetchAdvertiserStats:', error.message)
        return []
    }
    return data
}
