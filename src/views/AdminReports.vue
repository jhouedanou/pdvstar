<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, fetchReports, updateReportStatus } from '../services/supabase'
import { Flag, Check, X, RefreshCw, ExternalLink, Search } from 'lucide-vue-next'

const router = useRouter()

const all = ref([])
const loading = ref(false)
const statusFilter = ref('pending')

const searchQuery = ref('')

const filtered = computed(() => {
    let list = statusFilter.value === 'all' ? all.value : all.value.filter(r => r.status === statusFilter.value)
    const q = searchQuery.value.toLowerCase().trim()
    if (!q) return list
    return list.filter(r =>
        (r.events?.title || '').toLowerCase().includes(q) ||
        (r.events?.organizer || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.reporter_phone || '').includes(q)
    )
})

const counts = computed(() => ({
    all: all.value.length,
    pending: all.value.filter(r => r.status === 'pending').length,
    resolved: all.value.filter(r => r.status === 'resolved').length,
    dismissed: all.value.filter(r => r.status === 'dismissed').length,
}))

const load = async () => {
    loading.value = true
    const { data, error } = await supabase
        .from('reports')
        .select('*, events(title, organizer, image)')
        .order('created_at', { ascending: false })
    if (!error) all.value = data || []
    loading.value = false
}

const setStatus = async (r, status) => {
    await updateReportStatus(r.id, status)
    r.status = status
}

const goToEvent = (eventId) => {
    router.push(`/admin/events/${eventId}`)
}

onMounted(load)
</script>

<template>
  <div class="text-white">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Flag class="w-5 h-5 text-orange-400" />
          Signalements
        </h1>
        <p class="text-slate-400 text-sm">Modération du contenu signalé par les utilisateurs</p>
      </div>
      <button @click="load" :disabled="loading" class="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition">
        <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
        Actualiser
      </button>
    </div>

    <!-- Stat tabs -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
      <button @click="statusFilter = 'pending'" class="text-left bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-3 transition"
        :class="statusFilter === 'pending' ? 'ring-1 ring-orange-500' : ''">
        <p class="text-2xl font-bold text-orange-400">{{ counts.pending }}</p>
        <p class="text-xs text-slate-400">En attente</p>
      </button>
      <button @click="statusFilter = 'resolved'" class="text-left bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-3 transition"
        :class="statusFilter === 'resolved' ? 'ring-1 ring-red-500' : ''">
        <p class="text-2xl font-bold text-red-400">{{ counts.resolved }}</p>
        <p class="text-xs text-slate-400">Traités</p>
      </button>
      <button @click="statusFilter = 'dismissed'" class="text-left bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-3 transition"
        :class="statusFilter === 'dismissed' ? 'ring-1 ring-slate-500' : ''">
        <p class="text-2xl font-bold text-slate-400">{{ counts.dismissed }}</p>
        <p class="text-xs text-slate-400">Ignorés</p>
      </button>
      <button @click="statusFilter = 'all'" class="text-left bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-3 transition"
        :class="statusFilter === 'all' ? 'ring-1 ring-blue-500' : ''">
        <p class="text-2xl font-bold text-white">{{ counts.all }}</p>
        <p class="text-xs text-slate-400">Tous</p>
      </button>
    </div>

    <!-- Search -->
    <div class="relative mb-4">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input v-model="searchQuery" type="text" placeholder="Rechercher (event, raison, téléphone)..."
        class="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
    </div>

    <!-- Liste -->
    <div v-if="loading" class="text-center text-slate-500 py-8">Chargement...</div>
    <div v-else-if="!filtered.length" class="text-center text-slate-500 py-16">
      <Flag class="w-10 h-10 mx-auto opacity-30 mb-2" />
      <p class="text-sm">Aucun signalement</p>
    </div>
    <div v-else class="space-y-2">
      <div v-for="r in filtered" :key="r.id"
        class="bg-slate-800/40 border rounded-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-start"
        :class="r.status === 'pending' ? 'border-orange-500/30' : 'border-slate-700/40 opacity-75'">

        <img v-if="r.events?.image" :src="r.events.image" class="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
        <div v-else class="w-14 h-14 rounded-lg bg-slate-700 flex-shrink-0" />

        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <p class="text-sm font-medium text-white truncate">{{ r.events?.title || 'Event supprimé' }}</p>
            <span class="text-[9px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider"
              :class="{
                'bg-orange-500/20 text-orange-300': r.status === 'pending',
                'bg-red-500/20 text-red-300': r.status === 'resolved',
                'bg-slate-600/40 text-slate-300': r.status === 'dismissed'
              }">{{ r.status }}</span>
          </div>
          <p class="text-xs text-slate-400 mb-1">{{ r.events?.organizer || '—' }}</p>
          <p class="text-sm text-orange-300 italic">"{{ r.reason }}"</p>
          <p class="text-[10px] text-slate-600 mt-1">
            {{ r.reporter_phone }} — {{ new Date(r.created_at).toLocaleString('fr-FR') }}
          </p>
        </div>

        <div class="grid grid-cols-3 gap-1.5 sm:flex sm:flex-col sm:flex-shrink-0">
          <button v-if="r.events" @click="goToEvent(r.event_id)"
            class="text-[10px] px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition flex items-center gap-1">
            <ExternalLink class="w-3 h-3" /> Event
          </button>
          <button v-if="r.status === 'pending'" @click="setStatus(r, 'resolved')"
            class="text-[10px] px-2.5 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition flex items-center gap-1">
            <Check class="w-3 h-3" /> Agir
          </button>
          <button v-if="r.status === 'pending'" @click="setStatus(r, 'dismissed')"
            class="text-[10px] px-2.5 py-1.5 bg-slate-700 text-slate-400 hover:bg-slate-600 rounded-lg transition flex items-center gap-1">
            <X class="w-3 h-3" /> Ignorer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
