import { supabase } from './supabase'

const isMissingTable = (error) => error?.code === '42P01' || /does not exist/i.test(error?.message || '')

function mapAttendancePayload({ eventId, userId = null, pseudo, phone, city = null, district = null, latitude = null, longitude = null, source = 'feed' }) {
    return {
        event_id: eventId,
        profile_id: userId,
        pseudo,
        phone,
        city,
        district,
        latitude,
        longitude,
        source
    }
}

function mapLegacyRsvpPayload({ eventId, userId = null, pseudo, phone, source = 'feed' }) {
    return {
        event_id: eventId,
        user_id: userId,
        pseudo,
        phone,
        source
    }
}

/**
 * Enregistre une intention "J'y vais".
 * La table event_attendances est prioritaire, rsvps reste le fallback legacy.
 */
export async function createRsvp(payload) {
    const { eventId, pseudo, phone } = payload
    if (!eventId || !pseudo || !phone) {
        throw new Error('eventId, pseudo et phone sont requis')
    }

    try {
        const { data, error } = await supabase
            .from('event_attendances')
            .upsert(mapAttendancePayload(payload), { onConflict: 'event_id,phone' })
            .select()
            .single()

        if (!error) return { ...data, sourceTable: 'event_attendances' }
        if (!isMissingTable(error)) console.warn('createAttendance:', error.message)
    } catch (err) {
        console.warn('createAttendance:', err.message)
    }

    const { data, error } = await supabase
        .from('rsvps')
        .upsert(mapLegacyRsvpPayload(payload), { onConflict: 'event_id,phone' })
        .select()
        .single()

    if (error) {
        console.error('Erreur createRsvp:', error.message)
        return null
    }
    return { ...data, sourceTable: 'rsvps' }
}

export async function deleteRsvp(eventId, phone) {
    let ok = false

    try {
        const attendance = await supabase
            .from('event_attendances')
            .delete()
            .eq('event_id', eventId)
            .eq('phone', phone)
        ok = ok || !attendance.error || isMissingTable(attendance.error)
    } catch {
        ok = ok || false
    }

    const { error } = await supabase
        .from('rsvps')
        .delete()
        .eq('event_id', eventId)
        .eq('phone', phone)

    if (error) {
        console.error('Erreur deleteRsvp:', error.message)
        return ok
    }
    return true
}

export async function listRsvpsForEvent(eventId) {
    const rowsByPhone = new Map()

    try {
        const { data, error } = await supabase
            .from('event_attendances')
            .select('*')
            .eq('event_id', eventId)
            .order('created_at', { ascending: false })

        if (!error) {
            ;(data || []).forEach((row) => rowsByPhone.set(row.phone, { ...row, sourceTable: 'event_attendances' }))
        } else if (!isMissingTable(error)) {
            console.warn('listAttendancesForEvent:', error.message)
        }
    } catch (err) {
        console.warn('listAttendancesForEvent:', err.message)
    }

    const { data, error } = await supabase
        .from('rsvps')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

    if (!error) {
        ;(data || []).forEach((row) => {
            if (!rowsByPhone.has(row.phone)) rowsByPhone.set(row.phone, { ...row, sourceTable: 'rsvps' })
        })
    } else if (!isMissingTable(error)) {
        console.error('Erreur listRsvpsForEvent:', error.message)
    }

    return [...rowsByPhone.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
}

export async function markRsvpNotified(rsvpId) {
    try {
        await supabase
            .from('event_attendances')
            .update({ whatsapp_sent: true })
            .eq('id', rsvpId)
    } catch {
        // Legacy fallback below.
    }

    const { error } = await supabase
        .from('rsvps')
        .update({ notified_organizer: true })
        .eq('id', rsvpId)
    if (error && !isMissingTable(error)) console.error('Erreur markRsvpNotified:', error.message)
}

export async function countRsvpsForEvent(eventId) {
    const rows = await listRsvpsForEvent(eventId)
    return rows.length
}

/**
 * Génère un payload QR pour un RSVP (événement gratuit).
 * Le QR contient : type rsvp, eventId, phone, pseudo, nonce unique.
 */
export function genRsvpQrPayload(eventId, pseudo, phone) {
    const r = crypto.getRandomValues(new Uint8Array(8))
    const nonce = [...r].map(b => b.toString(16).padStart(2, '0')).join('')
    return JSON.stringify({ t: 'rsvp', eid: eventId, phone, pseudo, n: nonce })
}

/**
 * Check-in RSVP via QR code (scan à l'entrée de l'événement).
 * Retourne { ok, pseudo, phone } ou { ok: false, reason }
 */
export async function checkInRsvpByQr(qrPayload) {
    try {
        const data = JSON.parse(qrPayload)
        if (!data || data.t !== 'rsvp') return { ok: false, reason: 'QR invalide (type attendu: rsvp)' }
        const { eid: eventId, phone, pseudo } = data
        if (!eventId || !phone) return { ok: false, reason: 'QR corrompu (données manquantes)' }

        // Chercher dans event_attendances
        const { data: rows, error } = await supabase
            .from('event_attendances')
            .select('*')
            .eq('event_id', eventId)
            .eq('phone', phone)
            .maybeSingle()

        if (error || !rows) {
            return { ok: false, reason: 'Participant non trouvé dans la liste' }
        }
        if (rows.checked_in) {
            return { ok: false, reason: 'QR déjà utilisé — accès refusé' }
        }

        // Marquer check-in
        await supabase
            .from('event_attendances')
            .update({ checked_in: true, checked_in_at: new Date().toISOString() })
            .eq('event_id', eventId)
            .eq('phone', phone)

        return { ok: true, pseudo: rows.pseudo || pseudo, phone: rows.phone || phone, type: 'rsvp' }
    } catch (e) {
        return { ok: false, reason: `QR invalide: ${e.message}` }
    }
}

/**
 * Recupere les evenements proches via RPC PostGIS.
 * Fallback cote client si RPC indisponible.
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
        console.warn('RPC nearby_events indisponible, fallback fetchEvents:', error.message)
        return null
    }
    return data
}
