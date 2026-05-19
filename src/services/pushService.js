import { supabase } from './supabase'

/**
 * Phase 4 — Notifications push via OneSignal v16.
 * SDK + init() chargés depuis index.html (avec serviceWorkerPath = /OneSignalSDKWorker.js).
 * Ce module gère seulement subscribe/unsubscribe + sync table push_subscriptions.
 */

export const ONESIGNAL_APP_ID = '6dac9d35-658b-497f-8c5e-16539b1d58b7'

export async function initPush() {
    // Init est déjà fait dans index.html.
    // Retourne une promesse résolue quand SDK prêt.
    return new Promise((resolve) => {
        window.OneSignalDeferred = window.OneSignalDeferred || []
        window.OneSignalDeferred.push((OneSignal) => resolve(OneSignal))
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

/**
 * Lie la session OneSignal au userId Supabase.
 * Permet l'envoi de push ciblé via external_id.
 */
export async function loginOneSignal(userId) {
    if (!userId) return
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
        try { await OneSignal.login(String(userId)) } catch (e) { console.warn('OneSignal.login:', e) }
    })
}

export async function logoutOneSignal() {
    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async (OneSignal) => {
        try { await OneSignal.logout() } catch (e) { console.warn('OneSignal.logout:', e) }
    })
}

export async function unsubscribeUser(userId) {
    await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', 'onesignal')
    window.OneSignalDeferred?.push(async (OneSignal) => {
        try { await OneSignal.User.PushSubscription.optOut() } catch {}
    })
}
