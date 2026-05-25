import { supabase } from './supabase'
import { listRsvpsForEvent } from './rsvpService'
import { fetchTicketsForEvent } from './ticketService'

// Notifications dérivées (pas de table dédiée) — récentes 30 jours

const HORIZON_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Notifications pour un organisateur :
 * - Nouveaux RSVP sur ses events
 * - Nouveaux billets achetés
 * - Changement statut event (approved/rejected) par admin
 */
export const fetchOrganizerNotifications = async (organizerEvents) => {
    const notifs = []
    const since = Date.now() - HORIZON_MS

    for (const event of organizerEvents) {
        try {
            const [rsvps, tickets] = await Promise.all([
                listRsvpsForEvent(event.id),
                fetchTicketsForEvent(event.id)
            ])

            rsvps.forEach(r => {
                const t = new Date(r.created_at || 0).getTime()
                if (t < since) return
                notifs.push({
                    id: `rsvp-${r.id}`,
                    type: 'rsvp',
                    icon: 'users',
                    title: `Nouveau RSVP : ${r.pseudo || r.phone}`,
                    body: `${event.title}`,
                    timestamp: r.created_at,
                    eventId: event.id
                })
            })

            tickets.forEach(t => {
                const ts = new Date(t.created_at || 0).getTime()
                if (ts < since) return
                if (t.payment_status !== 'paid') return
                notifs.push({
                    id: `ticket-${t.id}`,
                    type: 'ticket',
                    icon: 'ticket',
                    title: `Billet vendu : ${t.buyer_pseudo || t.buyer_phone}`,
                    body: `${event.title} · ${t.price.toLocaleString()} CFA`,
                    timestamp: t.created_at,
                    eventId: event.id
                })
            })

            // Approbation / rejet
            if (event.approvedAt && new Date(event.approvedAt).getTime() >= since) {
                notifs.push({
                    id: `approved-${event.id}`,
                    type: 'approved',
                    icon: 'check',
                    title: `Événement approuvé`,
                    body: event.title,
                    timestamp: event.approvedAt,
                    eventId: event.id
                })
            }
            if (event.status === 'rejected' && event.rejectionReason) {
                notifs.push({
                    id: `rejected-${event.id}`,
                    type: 'rejected',
                    icon: 'x',
                    title: `Événement refusé`,
                    body: `${event.title} — ${event.rejectionReason}`,
                    timestamp: event.updatedAt || event.createdAt,
                    eventId: event.id
                })
            }
        } catch (e) {
            console.warn('Erreur notif event', event.id, e.message)
        }
    }

    return notifs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
}

/**
 * Notifications admin : events en attente, signalements récents
 */
export const fetchAdminNotifications = async () => {
    const notifs = []
    const since = new Date(Date.now() - HORIZON_MS).toISOString()

    try {
        const { data: pending } = await supabase
            .from('events')
            .select('id, title, organizer, organizerName:organizer_name, created_at, status')
            .eq('status', 'pending')
            .gte('created_at', since)
            .order('created_at', { ascending: false })

        ;(pending || []).forEach(e => {
            notifs.push({
                id: `pending-${e.id}`,
                type: 'pending',
                icon: 'clock',
                title: 'Événement à modérer',
                body: `${e.title} — par ${e.organizerName || e.organizer || 'Inconnu'}`,
                timestamp: e.created_at,
                eventId: e.id,
                actionUrl: `/admin/events/${e.id}`
            })
        })
    } catch (e) {
        console.warn('Erreur fetch pending:', e.message)
    }

    try {
        const { data: reports } = await supabase
            .from('reports')
            .select('*')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(20)

        ;(reports || []).forEach(r => {
            notifs.push({
                id: `report-${r.id}`,
                type: 'report',
                icon: 'flag',
                title: 'Nouveau signalement',
                body: r.reason || 'Signalement à examiner',
                timestamp: r.created_at,
                actionUrl: '/admin/reports'
            })
        })
    } catch (e) {
        // table reports peut ne pas exister
    }

    return notifs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
}
