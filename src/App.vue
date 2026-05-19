<script setup>
import { onMounted, watch } from 'vue'
import { useUserStore } from './stores/userStore'
import { initPush, subscribeUser } from './services/pushService'

const userStore = useUserStore()

onMounted(() => {
    initPush()
})

// Auto-subscribe push après login
watch(() => userStore.user?.id, (uid) => {
    if (uid && import.meta.env.VITE_ONESIGNAL_APP_ID) {
        subscribeUser(uid).catch(() => {})
    }
})
</script>

<template>
  <div class="min-h-screen w-screen bg-dark text-white font-sans">
    <router-view></router-view>
  </div>
</template>
