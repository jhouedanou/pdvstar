<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchUsers, updateUser, deleteUser } from '../services/supabase'
import { Search, Trash2, RefreshCw, Users as UsersIcon, Shield, Store, User } from 'lucide-vue-next'

const all = ref([])
const loading = ref(false)
const updating = ref(null)
const deleting = ref(null)
const query = ref('')
const roleFilter = ref('all')

const filtered = computed(() => {
    let list = all.value
    if (roleFilter.value !== 'all') {
        list = list.filter(u => {
            const r = u.role === 'user' ? 'consumer' : u.role
            return r === roleFilter.value
        })
    }
    if (query.value.trim()) {
        const q = query.value.toLowerCase()
        list = list.filter(u =>
            (u.pseudo || '').toLowerCase().includes(q) ||
            (u.name || '').toLowerCase().includes(q) ||
            (u.phone || '').includes(q) ||
            (u.email || '').toLowerCase().includes(q)
        )
    }
    return list
})

const counts = computed(() => {
    const total = all.value.length
    const admin = all.value.filter(u => u.role === 'admin').length
    const organizer = all.value.filter(u => u.role === 'organizer').length
    const consumer = total - admin - organizer
    return { total, admin, organizer, consumer }
})

const load = async () => {
    loading.value = true
    all.value = await fetchUsers()
    loading.value = false
}

const setRole = async (u, role) => {
    updating.value = u.id
    await updateUser(u.id, { role })
    u.role = role
    updating.value = null
}

const remove = async (u) => {
    if (!confirm(`Supprimer ${u.pseudo || u.name} (${u.phone}) ?`)) return
    deleting.value = u.id
    const ok = await deleteUser(u.id)
    if (ok) all.value = all.value.filter(x => x.id !== u.id)
    deleting.value = null
}

onMounted(load)
</script>

<template>
  <div class="text-white">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-100">Utilisateurs</h1>
        <p class="text-slate-400 text-sm">Gérer les comptes, rôles, suppressions</p>
      </div>
      <button @click="load" :disabled="loading" class="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition">
        <RefreshCw class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
        Actualiser
      </button>
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <button @click="roleFilter = 'all'" class="text-left bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-3 transition"
        :class="roleFilter === 'all' ? 'ring-1 ring-blue-500' : ''">
        <p class="text-2xl font-bold text-white">{{ counts.total }}</p>
        <p class="text-xs text-slate-400">Total</p>
      </button>
      <button @click="roleFilter = 'consumer'" class="text-left bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-3 transition"
        :class="roleFilter === 'consumer' ? 'ring-1 ring-slate-400' : ''">
        <p class="text-2xl font-bold text-slate-300">{{ counts.consumer }}</p>
        <p class="text-xs text-slate-400">Consumers</p>
      </button>
      <button @click="roleFilter = 'organizer'" class="text-left bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-3 transition"
        :class="roleFilter === 'organizer' ? 'ring-1 ring-blue-500' : ''">
        <p class="text-2xl font-bold text-blue-400">{{ counts.organizer }}</p>
        <p class="text-xs text-slate-400">Organizers</p>
      </button>
      <button @click="roleFilter = 'admin'" class="text-left bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 rounded-xl p-3 transition"
        :class="roleFilter === 'admin' ? 'ring-1 ring-purple-500' : ''">
        <p class="text-2xl font-bold text-purple-400">{{ counts.admin }}</p>
        <p class="text-xs text-slate-400">Admins</p>
      </button>
    </div>

    <!-- Search -->
    <div class="relative mb-4">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      <input v-model="query" type="text" placeholder="Rechercher (pseudo, téléphone, email)..."
        class="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center text-slate-500 py-8">Chargement...</div>

    <!-- Empty -->
    <div v-else-if="!filtered.length" class="text-center text-slate-500 py-12">
      <UsersIcon class="w-10 h-10 mx-auto opacity-30 mb-2" />
      <p class="text-sm">Aucun utilisateur</p>
    </div>

    <!-- Liste mobile + table desktop -->
    <div v-else>
      <div class="space-y-3 sm:hidden">
        <article
          v-for="u in filtered"
          :key="u.id"
          class="rounded-xl border border-slate-700/50 bg-slate-800/40 p-4"
        >
          <div class="mb-3 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-medium text-white">{{ u.pseudo || u.name || 'Anonyme' }}</p>
              <p class="mt-0.5 text-xs text-slate-500">{{ u.phone || 'Téléphone non renseigné' }}</p>
              <p v-if="u.email" class="truncate text-xs text-slate-500">{{ u.email }}</p>
            </div>
            <span class="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium"
              :class="{
                'bg-purple-500/20 text-purple-300': u.role === 'admin',
                'bg-blue-500/20 text-blue-300': u.role === 'organizer',
                'bg-slate-600/40 text-slate-300': !u.role || u.role === 'consumer' || u.role === 'user'
              }">
              {{ u.role === 'user' ? 'consumer' : (u.role || 'consumer') }}
            </span>
          </div>
          <div class="grid grid-cols-2 gap-2" v-if="updating !== u.id && deleting !== u.id">
            <button v-if="u.role !== 'organizer'" @click="setRole(u, 'organizer')"
              class="text-xs px-2 py-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 rounded-lg transition flex items-center justify-center gap-1">
              <Store class="w-3 h-3" /> Organizer
            </button>
            <button v-if="u.role !== 'consumer' && u.role !== 'user'" @click="setRole(u, 'consumer')"
              class="text-xs px-2 py-2 bg-slate-600/40 text-slate-300 hover:bg-slate-600/60 rounded-lg transition flex items-center justify-center gap-1">
              <User class="w-3 h-3" /> Consumer
            </button>
            <button v-if="u.role !== 'admin'" @click="setRole(u, 'admin')"
              class="text-xs px-2 py-2 bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 rounded-lg transition flex items-center justify-center gap-1">
              <Shield class="w-3 h-3" /> Admin
            </button>
            <button @click="remove(u)"
              class="text-xs px-2 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg transition flex items-center justify-center gap-1">
              <Trash2 class="w-3 h-3" /> Supprimer
            </button>
          </div>
          <p v-else class="text-xs text-slate-500">Mise à jour...</p>
        </article>
      </div>

      <div class="hidden sm:block bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-700/50 text-xs text-slate-400 uppercase tracking-wider">
            <th class="px-4 py-3 text-left">Utilisateur</th>
            <th class="px-4 py-3 text-left hidden sm:table-cell">Téléphone</th>
            <th class="px-4 py-3 text-left">Rôle</th>
            <th class="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in filtered" :key="u.id" class="border-b border-slate-700/30 hover:bg-slate-700/20">
            <td class="px-4 py-3">
              <p class="font-medium text-white truncate max-w-[160px]">{{ u.pseudo || u.name || 'Anonyme' }}</p>
              <p class="text-xs text-slate-500 sm:hidden">{{ u.phone }}</p>
            </td>
            <td class="px-4 py-3 text-slate-400 text-xs hidden sm:table-cell">{{ u.phone }}</td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="{
                  'bg-purple-500/20 text-purple-300': u.role === 'admin',
                  'bg-blue-500/20 text-blue-300': u.role === 'organizer',
                  'bg-slate-600/40 text-slate-300': !u.role || u.role === 'consumer' || u.role === 'user'
                }">
                {{ u.role === 'user' ? 'consumer' : (u.role || 'consumer') }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex gap-1 flex-wrap" v-if="updating !== u.id && deleting !== u.id">
                <button v-if="u.role !== 'organizer'" @click="setRole(u, 'organizer')"
                  class="text-[10px] px-2 py-1 bg-blue-500/20 text-blue-300 hover:bg-blue-500/40 rounded transition flex items-center gap-1">
                  <Store class="w-2.5 h-2.5" /> Organizer
                </button>
                <button v-if="u.role !== 'consumer' && u.role !== 'user'" @click="setRole(u, 'consumer')"
                  class="text-[10px] px-2 py-1 bg-slate-600/40 text-slate-300 hover:bg-slate-600/60 rounded transition flex items-center gap-1">
                  <User class="w-2.5 h-2.5" /> Consumer
                </button>
                <button v-if="u.role !== 'admin'" @click="setRole(u, 'admin')"
                  class="text-[10px] px-2 py-1 bg-purple-500/20 text-purple-300 hover:bg-purple-500/40 rounded transition flex items-center gap-1">
                  <Shield class="w-2.5 h-2.5" /> Admin
                </button>
                <button @click="remove(u)"
                  class="text-[10px] px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded transition flex items-center gap-1 ml-auto">
                  <Trash2 class="w-2.5 h-2.5" /> Supprimer
                </button>
              </div>
              <span v-else class="text-[10px] text-slate-500">...</span>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  </div>
</template>
