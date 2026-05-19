import { supabase } from './supabase'

/**
 * Enregistre un RSVP structuré ("J'y vais") pour un événement.
 * Idempotent via UNIQUE (event_id, phone) -> upsert.
 */
export async function createRsvp({ eventId, userId = null, pseudo, phone, source = 'app' }) {
    if (!eventId || !pseudo || !phone) {
        throw new Error('eventId, pseudo et phone sont requis')
    }
    const { data, error } = await supabase
        .from('rsvps')
        .upsert(
            {
                event_id: eventId,
                user_id: userId,
                pseudo,
                phone,
                source
            },
            { onConflict: 'event_id,phone' }
        )
        .select()
        .single()

    if (error) {
        console.error('❌ Erreur createRsvp:', error.message)
        return null
    }
    return data
}

export async function deleteRsvp(eventId, phone) {
    const { error } = await supabase
        .from('rsvps')
        .delete()
        .eq('event_id', eventId)
        .eq('phone', phone)
    if (error) {
        console.error('❌ Erreur deleteRsvp:', error.message)
        return false
    }
    return true
}

export async function listRsvpsForEvent(eventId) {
    const { data, error } = await supabase
        .from('rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
    if (error) {
        console.error('❌ Erreur listRsvpsForEvent:', error.message)
        return []
    }
    return data
}

export async function markRsvpNotified(rsvpId) {
    const { error } = await supabase
        .from('rsvps')
        .update({ notified_organizer: true })
        .eq('id', rsvpId)
    if (error) console.error('❌ Erreur markRsvpNotified:', error.message)
}

export async function countRsvpsForEvent(eventId) {
    const { count, error } = await supabase
        .from('rsvps')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
    if (error) {
        console.error('❌ Erreur countRsvpsForEvent:', error.message)
        return 0
    }
    return count || 0
}

/**
 * Récupère les événements proches via RPC PostGIS.
 * Fallback côté client si RPC indispo.
 */
export async function fetchNearbyEvents({ lat = null, lng = null, radiusKm = 50, quartier = null, tag = null, dateFrom = null, dateTo = null } = {}) {
    const { data, error } = await supabase.rpc('nearby_events', {
        user_lat: lat,
        user_lng: lng,
        radius_km: radiusKm,
        filter_quartier: quartier,
        filter_tag: tag,
        filter_date_from: dateFrom,
        filter_date_to: dateTo
    })
    if (error) {
        console.warn('⚠️ RPC nearby_events indispo, fallback fetchEvents:', error.message)
        return null
    }
    return data
}
