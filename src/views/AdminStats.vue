<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Calendar, Eye, MousePointerClick, UserRoundCheck, Users } from 'lucide-vue-next'
import { useEventStore } from '../stores/eventStore'
import { fetchGlobalStats } from '../services/statsService'

const router = useRouter()
const eventStore = useEventStore()
const remoteStats = ref(null)

onMounted(async () => {
    if (!eventStore.events.length) await eventStore.loadEvents()
    remoteStats.value = await fetchGlobalStats()
})

const localStats = computed(() => {
    const events = eventStore.events
    return {
        events_total: events.length,
        events_pending: events.filter((event) => event.status === 'pending').length,
        events_approved: events.filter((event) => !event.status || event.status === 'approved').length,
        total_attendances: events.reduce((sum, event) => sum + (event.participantCount || 0), 0),
        qualified_contacts: events.reduce((sum, event) => sum + (event.participantCount || 0), 0),
        event_views: events.reduce((sum, event) => sum + (event.viewCount || 0), 0),
        event_clicks: events.reduce((sum, event) => sum + (event.clickCount || 0), 0)
    }
})

const stats = computed(() => remoteStats.value || localStats.value)

const cards = computed(() => [
    { label: 'Total evenements', value: stats.value.events_total || 0, icon: Calendar },
    { label: 'En attente', value: stats.value.events_pending || 0, icon: Calendar },
    { label: 'Approuves', value: stats.value.events_approved || 0, icon: UserRoundCheck },
    { label: "J'y vais", value: stats.value.total_attendances || stats.value.total_rsvps || 0, icon: Users },
    { label: 'Contacts qualifies', value: stats.value.qualified_contacts || 0, icon: Users },
    { label: 'Vues', value: stats.value.event_views || 0, icon: Eye },
    { label: 'Clics', value: stats.value.event_clicks || 0, icon: MousePointerClick }
])
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <header class="sticky top-0 z-30 bg-surface border-b border-gray-800 px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <button @click="router.push('/admin/dashboard')" class="text-gray-400 hover:text-white flex items-center gap-2">
          <ArrowLeft class="w-4 h-4" />
          Dashboard
        </button>
        <h1 class="font-bold text-primary">Statistiques</h1>
        <div class="w-24"></div>
      </div>
    </header>

    <main class="max-w-5xl mx-auto p-4">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div v-for="card in cards" :key="card.label" class="bg-surface border border-gray-800 rounded-2xl p-5">
          <component :is="card.icon" class="w-5 h-5 text-primary mb-4" />
          <p class="text-3xl font-bold">{{ card.value }}</p>
          <p class="text-sm text-gray-500 mt-1">{{ card.label }}</p>
        </div>
      </div>
    </main>
  </div>
</template>
