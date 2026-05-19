// Supabase Edge Function — pawapay-webhook
// Deno runtime. Deploy:
//   supabase functions deploy pawapay-webhook --no-verify-jwt
// Configurer chez PawaPay l'URL: https://<project-ref>.functions.supabase.co/pawapay-webhook
//
// Sécurité prod:
//  - Vérifier signature/IP source PawaPay si fournie
//  - Stocker PAWAPAY_TOKEN dans secret pour vérifier transaction via API check
//  - SUPABASE_SERVICE_ROLE_KEY requis (bypass RLS pour update tickets)

// @ts-ignore Deno imports
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
// @ts-ignore Deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// @ts-ignore Deno env
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
// @ts-ignore Deno env
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
// @ts-ignore Deno env
const PAWAPAY_TOKEN = Deno.env.get('PAWAPAY_TOKEN') || ''
// @ts-ignore Deno env
const PAWAPAY_BASE = Deno.env.get('PAWAPAY_BASE_URL') || 'https://api.sandbox.pawapay.io'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function verifyDeposit(depositId: string) {
    if (!PAWAPAY_TOKEN) return null
    const res = await fetch(`${PAWAPAY_BASE}/deposits/${depositId}`, {
        headers: { 'Authorization': `Bearer ${PAWAPAY_TOKEN}` }
    })
    if (!res.ok) return null
    const data = await res.json()
    return Array.isArray(data) ? data[0] : data
}

serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 })
    }

    let body: any
    try {
        body = await req.json()
    } catch {
        return new Response('Invalid JSON', { status: 400 })
    }

    const depositId = body.depositId || body.deposit_id || body.id
    if (!depositId) return new Response('Missing depositId', { status: 400 })

    // Re-vérifier transaction côté PawaPay (anti-spoof)
    const verified = await verifyDeposit(depositId)
    const status = verified?.status || body.status

    if (status !== 'COMPLETED') {
        // Met à jour ticket en failed si applicable
        if (status === 'FAILED' || status === 'REJECTED') {
            await supabase.from('tickets')
                .update({ payment_status: 'failed' })
                .eq('id', depositId)
        }
        return new Response(JSON.stringify({ ok: true, status }), { status: 200 })
    }

    const providerTxId = verified?.providerTransactionId || body.providerTransactionId || depositId

    const { error } = await supabase
        .from('tickets')
        .update({
            payment_status: 'paid',
            payment_ref: providerTxId
        })
        .eq('id', depositId)

    if (error) {
        console.error('markTicketPaid error:', error)
        return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, ticketId: depositId, providerTxId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    })
})
