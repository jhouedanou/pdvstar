<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useUserStore } from './stores/userStore'
import { initPush, subscribeUser } from './services/pushService'
import AdminLayout from './components/AdminLayout.vue'
import PWAInstallPrompt from './components/PWAInstallPrompt.vue'

const route = useRoute()
const userStore = useUserStore()

const isAdminRoute = computed(() =>
    route.path.startsWith('/admin') && route.path !== '/admin'
)

onMounted(() => { initPush() })

watch(() => userStore.user?.id, (uid) => {
    if (uid && import.meta.env.VITE_ONESIGNAL_APP_ID) {
        subscribeUser(uid).catch(() => {})
    }
})
</script>

<template>
  <PWAInstallPrompt />

  <!-- Admin : full-width avec sidebar layout -->
  <AdminLayout v-if="isAdminRoute">
    <router-view />
  </AdminLayout>

  <!-- App user/organizer : centré, adaptatif mobile + tablette -->
  <div v-else class="app-shell">
    <div class="app-frame">
      <router-view />
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  width: 100%;
  background: #000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.app-frame {
  width: 100%;
  max-width: 640px;       /* tablette friendly, pas seulement iPhone */
  min-height: 100dvh;
  position: relative;
  overflow-x: hidden;
  background: #121212;
  color: #fff;
  font-family: 'Inter', sans-serif;
  transform: translateZ(0);
  isolation: isolate;
}

/* Mobile natif : plein écran */
@media (max-width: 640px) {
  .app-shell { background: #121212; }
  .app-frame { max-width: 100%; }
}
</style>
