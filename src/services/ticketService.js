import { supabase } from './supabase'

/**
 * Phase 3 — Billetterie
 * Workflow:
 *   1. createTicket(payment_status='pending') → CinetPay paie
 *   2. webhook/confirm → markTicketPaid → QR token utilisable
 *   3. redeem → RPC redeem_ticket (idempotent, marque used)
 */

function genQrToken() {
    // UUID v4 + timestamp, suffisant pour token QR non-deviné
    const r = crypto.getRandomValues(new Uint8Array(16))
    r[6] = (r[6] & 0x0f) | 0x40
    r[8] = (r[8] & 0x3f) | 0x80
    const h = [...r].map(b => b.toString(16).padStart(2, '0')).join('')
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`
}

export async function createTicket({ eventId, buyerId = null, buyerPhone, buyerPseudo, price, commissionRate = 5, paymentMethod }) {
    const commission = Math.round(price * (commissionRate / 100))
    const qrToken = genQrToken()
    const { data, error } = await supabase
        .from('tickets')
        .insert({
            event_id: eventId,
            buyer_id: buyerId,
            buyer_phone: buyerPhone,
            buyer_pseudo: buyerPseudo,
            price,
            commission,
            payment_method: paymentMethod,
            qr_token: qrToken,
            payment_status: paymentMethod === 'onsite' ? 'paid' : 'pending',
            status: 'valid'
        })
        .select()
        .single()
    if (error) {
        console.error(' createTicket:', error.message)
        return null
    }
    return data
}

export async function markTicketPaid(ticketId, paymentRef) {
    const { data, error } = await supabase
        .from('tickets')
        .update({ payment_status: 'paid', payment_ref: paymentRef })
        .eq('id', ticketId)
        .select()
        .single()
    if (error) {
        console.error(' markTicketPaid:', error.message)
        return null
    }
    return data
}

export async function redeemTicket(qrToken, adminId) {
    const { data, error } = await supabase.rpc('redeem_ticket', { token: qrToken, admin_uid: adminId })
    if (error) {
        console.error(' redeemTicket:', error.message)
        return { ok: false, reason: error.message }
    }
    return { ok: true, ticket: data }
}

export async function fetchTicketsForEvent(eventId) {
    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
    if (error) {
        console.error(' fetchTicketsForEvent:', error.message)
        return []
    }
    return data
}

export async function fetchTicketsForBuyer(buyerId) {
    const { data, error } = await supabase
        .from('tickets')
        .select('*, events(title, date, location)')
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false })
    if (error) {
        console.error(' fetchTicketsForBuyer:', error.message)
        return []
    }
    return data
}

/**
 * Génère un Data URL QR pour affichage.
 * Nécessite: yarn add qrcode
 */
export async function buildQrDataUrl(token) {
    try {
        const modName = 'qrcode'
        const QR = await import(/* @vite-ignore */ modName)
        return await QR.toDataURL(token, { width: 320, margin: 1, errorCorrectionLevel: 'H' })
    } catch (e) {
        console.warn('️ qrcode npm absent, fallback URL externe:', e?.message)
        // Fallback CDN (api gratuite, à remplacer en prod)
        return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(token)}`
    }
}
