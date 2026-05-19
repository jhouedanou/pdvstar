/**
 * Phase 3 — Paiement Mobile Money via PawaPay
 * Doc: https://docs.pawapay.io
 *
 * Endpoints:
 *   - Sandbox: https://api.sandbox.pawapay.io
 *   - Prod:    https://api.pawapay.io
 *
 * Auth: Bearer token (VITE_PAWAPAY_TOKEN)
 *
 * Flow:
 *   1. predictProvider(phone) → détecte opérateur (ORANGE_CI / MTN_CI / MOOV_CI / WAVE_CI)
 *   2. initDeposit({ depositId=ticketId, amount, currency=XOF, phone, provider }) → PawaPay
 *   3. Polling checkDeposit(depositId) jusqu'à status=COMPLETED → markTicketPaid
 *   4. Webhook PawaPay (recommandé prod) → Supabase Edge Function pour confirmer
 *
 * Note sécurité : appeler PawaPay depuis une Edge Function en prod
 * (Bearer token côté serveur). En dev/MVP : tolérable côté client.
 */

function getConfig() {
    return {
        baseUrl: import.meta.env.VITE_PAWAPAY_BASE_URL || 'https://api.sandbox.pawapay.io',
        token: import.meta.env.VITE_PAWAPAY_TOKEN,
        callbackUrl: import.meta.env.VITE_PAWAPAY_CALLBACK_URL || `${window.location.origin}/api/pawapay-webhook`
    }
}

function headers() {
    const { token } = getConfig()
    if (!token) throw new Error('VITE_PAWAPAY_TOKEN manquant')
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    }
}

/**
 * Prédit l'opérateur Mobile Money d'un numéro.
 * @param {string} phone — format international sans + (ex: 22507XXXXXXXX)
 * @returns {Promise<string|null>} providerCode (ORANGE_CI, MTN_CI, MOOV_CI, WAVE_CI)
 */
export async function predictProvider(phone) {
    const { baseUrl } = getConfig()
    const clean = String(phone).replace(/[^\d]/g, '')
    try {
        const res = await fetch(`${baseUrl}/v2/predict-provider`, {
            method: 'POST',
            headers: headers(),
            body: JSON.stringify({ phoneNumber: clean })
        })
        if (!res.ok) return null
        const data = await res.json()
        return data.provider || data.correspondent || null
    } catch (e) {
        console.warn('predictProvider:', e?.message)
        return null
    }
}

/**
 * Initie un dépôt Mobile Money via PawaPay.
 * @param {Object} opts
 *   depositId (UUID unique, généralement ticketId)
 *   amount (string ou number, en XOF)
 *   phone (international sans +)
 *   provider (optionnel, sinon prédit auto)
 *   description
 */
export async function initDeposit({ depositId, amount, phone, provider = null, description = 'Billet événement', currency = 'XOF' }) {
    const { baseUrl } = getConfig()
    const clean = String(phone).replace(/[^\d]/g, '')

    let providerCode = provider
    if (!providerCode) {
        providerCode = await predictProvider(clean)
        if (!providerCode) throw new Error('Opérateur Mobile Money non détecté pour ' + phone)
    }

    const payload = {
        depositId,
        amount: String(amount),
        currency,
        country: 'CIV',
        correspondent: providerCode,
        payer: {
            type: 'MSISDN',
            address: { value: clean }
        },
        customerTimestamp: new Date().toISOString(),
        statementDescription: description.slice(0, 22)
    }

    const res = await fetch(`${baseUrl}/deposits`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok || data.status === 'REJECTED') {
        throw new Error('PawaPay init error: ' + (data.rejectionReason?.rejectionMessage || data.message || JSON.stringify(data)))
    }
    return {
        depositId,
        status: data.status,        // ACCEPTED | ENQUEUED | SUBMITTED
        provider: providerCode,
        raw: data
    }
}

/**
 * Vérifie le statut d'un dépôt (polling).
 * @returns {Promise<{status: string, raw: Object}>}
 *   status: PENDING | COMPLETED | FAILED | REJECTED | SUBMITTED | ENQUEUED
 */
export async function checkDeposit(depositId) {
    const { baseUrl } = getConfig()
    const res = await fetch(`${baseUrl}/deposits/${depositId}`, {
        method: 'GET',
        headers: headers()
    })
    if (!res.ok) throw new Error('PawaPay check error: ' + res.statusText)
    const data = await res.json()
    const dep = Array.isArray(data) ? data[0] : data
    return {
        status: dep?.status || 'UNKNOWN',
        failureReason: dep?.failureReason?.failureMessage || null,
        providerTxId: dep?.providerTransactionId || null,
        raw: dep
    }
}

/**
 * Helper polling : attend jusqu'à un état final.
 */
export async function waitForDepositFinal(depositId, { timeoutMs = 120000, intervalMs = 3000 } = {}) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
        const r = await checkDeposit(depositId)
        if (['COMPLETED', 'FAILED', 'REJECTED'].includes(r.status)) return r
        await new Promise(res => setTimeout(res, intervalMs))
    }
    return { status: 'TIMEOUT', failureReason: 'Délai dépassé', raw: null }
}

export const PAWAPAY_PROVIDERS_CI = [
    { code: 'ORANGE_CI', name: 'Orange Money',  emoji: '🟠' },
    { code: 'MTN_CI',    name: 'MTN MoMo',      emoji: '🟡' },
    { code: 'MOOV_CI',   name: 'Moov Money',    emoji: '🔵' },
    { code: 'WAVE_CI',   name: 'Wave',          emoji: '💧' }
]
