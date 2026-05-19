import { supabase } from './supabase'

/**
 * Phase 2 — Workflow modération
 * status: draft | pending | approved | rejected
 */

export async function submitEventForReview(eventId) {
    const { data, error } = await supabase
        .from('events')
        .update({ status: 'pending', rejection_reason: null })
        .eq('id', eventId)
        .select()
        .single()
    if (error) {
        console.error('❌ submitEventForReview:', error.message)
        return null
    }
    return data
}

export async function approveEvent(eventId, adminId = null) {
    const { data, error } = await supabase
        .from('events')
        .update({
            status: 'approved',
            rejection_reason: null,
            approved_by: adminId,
            approved_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .select()
        .single()
    if (error) {
        console.error('❌ approveEvent:', error.message)
        return null
    }
    await logModeration(eventId, adminId, 'approve', null)
    return data
}

export async function rejectEvent(eventId, reason, adminId = null) {
    if (!reason) throw new Error('Motif de rejet requis')
    const { data, error } = await supabase
        .from('events')
        .update({ status: 'rejected', rejection_reason: reason })
        .eq('id', eventId)
        .select()
        .single()
    if (error) {
        console.error('❌ rejectEvent:', error.message)
        return null
    }
    await logModeration(eventId, adminId, 'reject', reason)
    return data
}

export async function fetchPendingEvents() {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    if (error) {
        console.error('❌ fetchPendingEvents:', error.message)
        return []
    }
    return data
}

export async function fetchEventsByStatus(status) {
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false })
    if (error) {
        console.error('❌ fetchEventsByStatus:', error.message)
        return []
    }
    return data
}

async function logModeration(eventId, adminId, action, reason) {
    const { error } = await supabase
        .from('moderation_log')
        .insert({ event_id: eventId, admin_id: adminId, action, reason })
    if (error) console.warn('⚠️ logModeration:', error.message)
}

export async function fetchModerationLog(eventId = null) {
    let q = supabase.from('moderation_log').select('*').order('created_at', { ascending: false })
    if (eventId) q = q.eq('event_id', eventId)
    const { data, error } = await q
    if (error) {
        console.error('❌ fetchModerationLog:', error.message)
        return []
    }
    return data
}
