import { supabase } from './supabase'

/**
 * Phase 4 — Stats globales et par dimension (admin dashboard avancé).
 */

export async function fetchGlobalStats() {
    const { data, error } = await supabase.from('global_stats').select('*').single()
    if (error) {
        console.error(' fetchGlobalStats:', error.message)
        return null
    }
    return data
}

export async function fetchStatsByQuartier() {
    const { data, error } = await supabase.from('stats_by_quartier').select('*')
    if (error) {
        console.error(' fetchStatsByQuartier:', error.message)
        return []
    }
    return data
}

/**
 * Stats événement: RSVP, billets, revenus, vues pub liées.
 */
export async function fetchEventStats(eventId) {
    const [attendances, legacyRsvps, tickets] = await Promise.all([
        supabase.from('event_attendances').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('rsvps').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('tickets').select('price, commission, payment_status, status').eq('event_id', eventId)
    ])

    const ticketRows = tickets.data || []
    const paid = ticketRows.filter(t => t.payment_status === 'paid')
    return {
        rsvpCount: attendances.count || legacyRsvps.count || 0,
        ticketsSold: paid.length,
        ticketsUsed: paid.filter(t => t.status === 'used').length,
        revenue: paid.reduce((s, t) => s + (t.price || 0), 0),
        commission: paid.reduce((s, t) => s + (t.commission || 0), 0)
    }
}

/**
 * Export CSV générique. Charger papaparse dynamiquement.
 */
export async function exportToCsv(filename, rows) {
    const modName = 'papaparse'
    const Papa = await import(/* @vite-ignore */ modName)
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}
