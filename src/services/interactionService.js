import { supabase } from './supabase'

const VIEW_COOLDOWN_MS = 5 * 60 * 1000

const counterByType = {
    view: 'view_count',
    click_going: 'click_count',
    reservation_click: 'click_count'
}

function storageKey(eventId, type) {
    return `babivibes_interaction_${type}_${eventId}`
}

function shouldSkipInteraction(eventId, type) {
    if (type !== 'view' || typeof localStorage === 'undefined') return false
    const key = storageKey(eventId, type)
    const last = Number(localStorage.getItem(key) || 0)
    if (last && Date.now() - last < VIEW_COOLDOWN_MS) return true
    localStorage.setItem(key, String(Date.now()))
    return false
}

async function incrementLegacyCounter(eventId, type) {
    const column = counterByType[type]
    if (!column) return

    try {
        const { data } = await supabase
            .from('events')
            .select(column)
            .eq('id', eventId)
            .single()

        if (data) {
            await supabase
                .from('events')
                .update({ [column]: (data[column] || 0) + 1 })
                .eq('id', eventId)
        }
    } catch {
        // The legacy schema may not expose counters yet.
    }
}

export async function trackEventInteraction({ eventId, profileId = null, type = 'view', metadata = {}, dedupe = true }) {
    if (!eventId) return false
    if (dedupe && shouldSkipInteraction(eventId, type)) return false

    try {
        const { error } = await supabase.rpc('track_event_interaction', {
            p_event_id: eventId,
            p_profile_id: profileId,
            p_interaction_type: type,
            p_metadata: metadata
        })

        if (!error) return true
        console.warn('track_event_interaction RPC:', error.message)
    } catch (err) {
        console.warn('track_event_interaction RPC:', err.message)
    }

    try {
        await supabase.from('event_interactions').insert({
            event_id: eventId,
            profile_id: profileId,
            interaction_type: type,
            metadata
        })
    } catch {
        // Continue to counter fallback.
    }

    await incrementLegacyCounter(eventId, type)
    return true
}
