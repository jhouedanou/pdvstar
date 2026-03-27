<script setup>
import { WifiOff, Wifi, Loader2 } from 'lucide-vue-next'

defineProps({
  showOfflineBanner: Boolean,
  showReconnectBanner: Boolean,
  isSyncing: Boolean
})
</script>

<template>
  <!-- Bandeau Hors connexion (rouge) -->
  <Transition name="slide-banner">
    <div
      v-if="showOfflineBanner"
      class="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
    >
      <WifiOff class="w-4 h-4" />
      Hors connexion
    </div>
  </Transition>

  <!-- Bandeau Reconnexion / Synchronisation (vert/gold) -->
  <Transition name="slide-banner">
    <div
      v-if="showReconnectBanner"
      class="fixed top-0 left-0 right-0 z-[100] text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-lg"
      :class="isSyncing ? 'bg-yellow-600' : 'bg-green-600'"
    >
      <Loader2 v-if="isSyncing" class="w-4 h-4 animate-spin" />
      <Wifi v-else class="w-4 h-4" />
      {{ isSyncing ? 'Synchronisation en cours...' : 'Connexion retablie' }}
    </div>
  </Transition>
</template>

<style scoped>
.slide-banner-enter-active,
.slide-banner-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-banner-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}
.slide-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
