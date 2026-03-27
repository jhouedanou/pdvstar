import { ref, onMounted, onUnmounted } from 'vue'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'

/**
 * Composable de detection connexion + auto-resync
 * - Ecoute online/offline events + navigator.onLine
 * - Ecoute visibilitychange - re-sync si onglet invisible > 2 min
 * - resync() appelle eventStore.loadEvents() + userStore.loadActivePass()
 * - Expose : isOnline, isSyncing, showOfflineBanner, showReconnectBanner
 */
export function useConnectionStatus() {
  const isOnline = ref(navigator.onLine)
  const isSyncing = ref(false)
  const showOfflineBanner = ref(!navigator.onLine)
  const showReconnectBanner = ref(false)

  let hiddenSince = null
  let reconnectTimer = null
  const VISIBILITY_THRESHOLD = 2 * 60 * 1000 // 2 minutes

  async function resync() {
    if (isSyncing.value) return
    isSyncing.value = true
    try {
      const eventStore = useEventStore()
      const userStore = useUserStore()
      await Promise.all([
        eventStore.loadEvents(),
        userStore.loadActivePass()
      ])
    } catch (e) {
      console.warn('Resync failed:', e)
    } finally {
      isSyncing.value = false
    }
  }

  function handleOnline() {
    isOnline.value = true
    showOfflineBanner.value = false
    showReconnectBanner.value = true

    // Re-sync au retour en ligne
    resync()

    // Masquer le bandeau de reconnexion apres 3s
    clearTimeout(reconnectTimer)
    reconnectTimer = setTimeout(() => {
      showReconnectBanner.value = false
    }, 3000)
  }

  function handleOffline() {
    isOnline.value = false
    showOfflineBanner.value = true
    showReconnectBanner.value = false
    clearTimeout(reconnectTimer)
  }

  function handleVisibilityChange() {
    if (document.hidden) {
      hiddenSince = Date.now()
    } else {
      // Onglet redevient visible
      if (hiddenSince && (Date.now() - hiddenSince) > VISIBILITY_THRESHOLD) {
        // Plus de 2 minutes en arriere-plan → resync
        if (isOnline.value) {
          resync()
        }
      }
      hiddenSince = null
    }
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    clearTimeout(reconnectTimer)
  })

  return {
    isOnline,
    isSyncing,
    showOfflineBanner,
    showReconnectBanner
  }
}
