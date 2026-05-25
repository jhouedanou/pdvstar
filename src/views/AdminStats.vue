<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '../stores/eventStore'
import { supabase } from '../services/supabase'
import {
    Calendar, Eye, MousePointerClick, Users, Clock, CheckCircle,
    XCircle, TrendingUp, RefreshCw, ChevronRight, X
} from 'lucide-vue-next'

const router = useRouter()
const eventStore = useEventStore()

const rsvpTotal = ref(0)
const ticketTotal = ref(0)
const loading = ref(false)
const drillPanel = ref(null) // null | 'total' | 'pending' | 'approved' | 'rejected' | 'rsvp'
const drillQuery = ref('')

onMounted(async () => {
    if (!eventStore.events.length) await eventStore.loadEvents()
    loading.value = true
    const [{ count: rc }, { count: tc }] = await Promise.all([
        supabase.from('rsvps').select('id', { count: 'exact', head: true }),
        supabase.from('tickets').select('id', { count: 'exact', head: true })
    ])
    rsvpTotal.value = rc || 0
    ticketTotal.value = tc || 0
    loading.value = false
})

const events = computed(() => eventStore.events)

const stats = computed(() => ({
    total: events.value.length,
    pending: events.value.filter(e => e.status === 'pending').length,
    approved: events.value.filter(e => !e.status || e.status === 'approved').length,
    rejected: events.value.filter(e => e.status === 'rejected').length,
    rsvp: rsvpTotal.value,
    tickets: ticketTotal.value,
    premium: events.value.filter(e => e.isPremium).length,
}))

const cards = [
    { key: 'total',    label: 'Événements',     color: 'text-blue-400',   icon: Calendar },
    { key: 'pending',  label: 'En attente',      color: 'text-yellow-400', icon: Clock },
    { key: 'approved', label: 'Approuvés',       color: 'text-green-400',  icon: CheckCircle },
    { key: 'rejected', label: 'Rejetés',         color: 'text-red-400',    icon: XCircle },
    { key: 'rsvp',     label: "J'y vais (RSVP)", color: 'text-primary',    icon: Users },
    { key: 'tickets',  label: 'Billets vendus',  color: 'text-purple-400', icon: TrendingUp },
    { key: 'premium',  label: 'Premium',         color: 'text-amber-400',  icon: Eye },
]

// Drill-down events pour la carte cliquée
const drillEvents = computed(() => {
    const q = drillQuery.value.toLowerCase()
    let list = []
    if (drillPanel.value === 'total')    list = events.value
    if (drillPanel.value === 'pending')  list = events.value.filter(e => e.status === 'pending')
    if (drillPanel.value === 'approved') list = events.value.filter(e => !e.status || e.status === 'approved')
    if (drillPanel.value === 'rejected') list = events.value.filter(e => e.status === 'rejected')
    if (drillPanel.value === 'premium')  list = events.value.filter(e => e.isPremium)
    if (drillPanel.value === 'rsvp' || drillPanel.value === 'tickets') list = events.value
    if (q) list = list.filter(e =>
        (e.title||'').toLowerCase().includes(q) ||
        (e.organizer||'').toLowerCase().includes(q) ||
        (e.location||'').toLowerCase().includes(q)
    )
    return list.slice(0, 50)
})

const openDrill = (key) => {
    // rsvp/tickets pas de liste d'events granulaire — ouvre quand même total
    drillPanel.value = key
    drillQuery.value = ''
}

const statusBadge = (e) => {
    if (!e.status || e.status === 'approved') return { label: 'Approuvé', cls: 'bg-green-500/20 text-green-400' }
    if (e.status === 'pending') return { label: 'En attente', cls: 'bg-yellow-500/20 text-yellow-400' }
    if (e.status === 'rejected') return { label: 'Rejeté', cls: 'bg-red-500/20 text-red-400' }
    return { label: e.status, cls: 'bg-gray-600/40 text-gray-400' }
}
</script>

<template>
  <div class="text-white">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-100">Statistiques</h1>
        <p class="text-slate-400 text-sm">Données en temps réel</p>
      </div>
      <button @click="eventStore.loadEvents()" class="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition">
        <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
        Actualiser
      </button>
    </div>

    <!-- Cards cliquables -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
      <button
        v-for="c in cards" :key="c.key"
        @click="openDrill(c.key)"
        class="text-left bg-slate-800/50 hover:bg-slate-700/50 border rounded-xl p-4 transition group"
        :class="drillPanel === c.key ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-700'"
      >
        <component :is="c.icon" class="w-5 h-5 mb-3" :class="c.color" />
        <p class="text-2xl font-bold text-white">{{ stats[c.key] ?? '—' }}</p>
        <p class="text-xs text-slate-400 mt-1">{{ c.label }}</p>
        <p class="text-[10px] mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition" :class="c.color">
          Voir détail <ChevronRight class="w-3 h-3" />
        </p>
      </button>
    </div>

    <!-- Drill-down panel -->
    <div v-if="drillPanel && !['rsvp','tickets'].includes(drillPanel)" class="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <h2 class="font-semibold text-slate-200 text-sm">
          {{ cards.find(c => c.key === drillPanel)?.label }} — {{ drillEvents.length }} résultat(s)
        </h2>
        <div class="flex items-center gap-2">
          <input v-model="drillQuery" type="text" placeholder="Filtrer..."
            class="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-48" />
          <button @click="drillPanel = null" class="p-1.5 hover:bg-slate-700 rounded-lg transition">
            <X class="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>
      <div class="max-h-80 overflow-y-auto">
        <div v-if="!drillEvents.length" class="text-center text-slate-500 py-8 text-sm">Aucun résultat</div>
        <div v-else class="overflow-x-auto">
        <table class="min-w-[520px] w-full text-sm">
          <tbody>
            <tr v-for="e in drillEvents" :key="e.id"
              class="border-b border-slate-700/30 hover:bg-slate-700/20 cursor-pointer transition"
              @click="router.push(`/admin/events/${e.id}`)">
              <td class="px-4 py-2.5">
                <p class="font-medium text-white truncate max-w-[200px]">{{ e.title }}</p>
                <p class="text-xs text-slate-500">{{ e.organizer }} · {{ e.location }}</p>
              </td>
              <td class="px-4 py-2.5 text-xs text-slate-400 hidden sm:table-cell">
                {{ e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '—' }}
              </td>
              <td class="px-4 py-2.5">
                <span class="text-xs px-2 py-0.5 rounded-full" :class="statusBadge(e).cls">
                  {{ statusBadge(e).label }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-xs text-slate-400 hidden md:table-cell">
                {{ e.participantCount || 0 }} inscrits
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>
    </div>

    <!-- RSVP/Tickets message -->
    <div v-else-if="drillPanel === 'rsvp'" class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 flex items-center justify-between">
      <div>
        <p class="text-white font-bold text-2xl">{{ rsvpTotal }}</p>
        <p class="text-slate-400 text-sm">J'y vais total (table rsvps)</p>
      </div>
      <button @click="drillPanel = null" class="p-1.5 hover:bg-slate-700 rounded-lg">
        <X class="w-4 h-4 text-slate-400" />
      </button>
    </div>
    <div v-else-if="drillPanel === 'tickets'" class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-6 flex items-center justify-between">
      <div>
        <p class="text-white font-bold text-2xl">{{ ticketTotal }}</p>
        <p class="text-slate-400 text-sm">Billets émis (table tickets)</p>
      </div>
      <button @click="drillPanel = null" class="p-1.5 hover:bg-slate-700 rounded-lg">
        <X class="w-4 h-4 text-slate-400" />
      </button>
    </div>
  </div>
</template>
