<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, Clock, Flag, Loader2, RefreshCw } from 'lucide-vue-next'
import { fetchAdminNotifications } from '../services/notificationsService'

const router = useRouter()

const notifications = ref([])
const loading = ref(false)

const load = async () => {
    loading.value = true
    try {
        notifications.value = await fetchAdminNotifications()
    } finally {
        loading.value = false
    }
}

const formatTimeAgo = (ts) => {
    if (!ts) return ''
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'à l\'instant'
    if (mins < 60) return `il y a ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `il y a ${hrs}h`
    return `il y a ${Math.floor(hrs / 24)}j`
}

onMounted(load)
</script>

<template>
  <div class="text-white">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Bell class="w-5 h-5 text-orange-400" />
          Notifications
        </h1>
        <p class="text-slate-400 text-sm">Activité plateforme — 30 derniers jours</p>
      </div>
      <button @click="load" :disabled="loading" class="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition disabled:opacity-50">
        <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
        Actualiser
      </button>
    </div>

    <div v-if="loading && !notifications.length" class="text-center py-16">
      <Loader2 class="w-8 h-8 text-orange-400 animate-spin mx-auto mb-3" />
      <p class="text-slate-400 text-sm">Chargement...</p>
    </div>

    <div v-else-if="!notifications.length" class="text-center py-16 bg-slate-800/40 border border-slate-700/50 rounded-xl">
      <Bell class="w-16 h-16 text-slate-700 mx-auto mb-4" />
      <p class="text-slate-400 text-lg mb-1">Aucune notification</p>
      <p class="text-slate-600 text-sm">Les soumissions et signalements apparaîtront ici</p>
    </div>

    <div v-else class="space-y-2">
      <div v-for="n in notifications" :key="n.id"
        @click="n.actionUrl && router.push(n.actionUrl)"
        class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 flex items-start gap-3 cursor-pointer hover:border-slate-600 transition">
        <div class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          :class="{
            'bg-yellow-500/20 text-yellow-400': n.type === 'pending',
            'bg-orange-500/20 text-orange-400': n.type === 'report'
          }">
          <Clock v-if="n.type === 'pending'" class="w-5 h-5" />
          <Flag v-else-if="n.type === 'report'" class="w-5 h-5" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white">{{ n.title }}</p>
          <p class="text-xs text-slate-400 mt-0.5">{{ n.body }}</p>
          <p class="text-[10px] text-slate-600 mt-1">{{ formatTimeAgo(n.timestamp) }}</p>
        </div>
        <span v-if="n.actionUrl" class="text-slate-500 text-xs">→</span>
      </div>
    </div>
  </div>
</template>
