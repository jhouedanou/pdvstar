import { supabase } from './supabase'

/**
 * Phase 4 — Notifications push via OneSignal (gratuit jusqu'à 10k subs).
 * Fallback: Web Push API + Supabase Edge Function.
 *
 * Setup OneSignal:
 *   1. Créer app sur https://onesignal.com
 *   2. VITE_ONESIGNAL_APP_ID dans .env
 *   3. Charger SDK dans index.html ou dynamiquement
 */

let initialized = false

export async function initPush() {
    if (initialized) return
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID
    if (!appId) {
        console.warn('VITE_ONESIGNAL_APP_ID absent, push désactivé')
        return
    }

    // Charger SDK OneSignal dynamiquement
    if (!window.OneSignalDeferred) {
        window.OneSignalDeferred = []
        const s = document.createElement('script')
        s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
        s.defer = true
        document.head.appendChild(s)
    }

    window.OneSignalDeferred.push(async (OneSignal) => {
        await OneSignal.init({ appId, allowLocalhostAsSecureOrigin: true })
        initialized = true
    })
}

export async function subscribeUser(userId, quartier = null) {
    return new Promise((resolve) => {
        window.OneSignalDeferred = window.OneSignalDeferred || []
        window.OneSignalDeferred.push(async (OneSignal) => {
            try {
                await OneSignal.Slidedown.promptPush()
                const playerId = OneSignal.User.PushSubscription.id
                if (playerId && userId) {
                    await supabase.from('push_subscriptions').upsert({
                        user_id: userId,
                        endpoint: 'onesignal',
                        onesignal_player_id: playerId,
                        quartier
                    }, { onConflict: 'user_id,endpoint' })
                }
                resolve(playerId)
            } catch (e) {
                console.error('subscribeUser:', e)
                resolve(null)
            }
        })
    })
}

export async function unsubscribeUser(userId) {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', 'onesignal')
    window.OneSignalDeferred?.push(async (OneSignal) => {
        try { await OneSignal.User.PushSubscription.optOut() } catch {}
    })
}
