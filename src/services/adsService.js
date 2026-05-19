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
        startDate: row.start_date,
        endDate: row.end_date,
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
    if (d.startDate !== undefined) m.start_date = d.startDate
    if (d.endDate !== undefined) m.end_date = d.endDate
    if (d.position !== undefined) m.position = d.position
    if (d.createdBy !== undefined) m.created_by = d.createdBy
    return m
}

export async function fetchAdsForUser({ quartier = null, pdv = null } = {}) {
    let q = supabase.from('ads').select('*').eq('is_active', true).order('position', { ascending: true })
    const { data, error } = await q
    if (error) {
        console.error('❌ fetchAdsForUser:', error.message)
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
        console.error('❌ createAdvert:', error.message)
        return null
    }
    return fromSupabaseAd(data)
}

export async function updateAdvert(id, updates) {
    const { data, error } = await supabase.from('ads').update(toSupabaseAd(updates)).eq('id', id).select().single()
    if (error) {
        console.error('❌ updateAdvert:', error.message)
        return null
    }
    return fromSupabaseAd(data)
}

export async function toggleAdActive(id, isActive) {
    return updateAdvert(id, { isActive })
}

export async function trackAd({ adId, type = 'view', userId = null, quartier = null }) {
    const { error } = await supabase.rpc('track_ad', {
        ad: adId, etype: type, uid: userId, q: quartier
    })
    if (error) console.warn('⚠️ trackAd RPC échoué:', error.message)
}

export async function fetchAdvertiserStats(advertiserId) {
    const { data, error } = await supabase
        .from('ads')
        .select('id, title, view_count, click_count, is_active')
        .eq('advertiser_id', advertiserId)
    if (error) {
        console.error('❌ fetchAdvertiserStats:', error.message)
        return []
    }
    return data
}
