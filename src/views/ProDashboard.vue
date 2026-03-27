<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { useConnectionStatus } from '../composables/useConnectionStatus'
import ConnectionBanner from '../components/ConnectionBanner.vue'
import UserProfileModal from '../components/UserProfileModal.vue'
import {
  ArrowLeft, Plus, Edit, Trash2, Calendar, MapPin,
  Check, X, Loader2, Store, Megaphone, Clock,
  ShieldCheck, ShieldX, AlertTriangle, Ticket, Crown
} from 'lucide-vue-next'
import { PASS_CATALOG } from '../services/supabase'

const router = useRouter()
const eventStore = useEventStore()
const userStore = useUserStore()
const { isOnline, isSyncing, showOfflineBanner, showReconnectBanner } = useConnectionStatus()

// ============================
// Auth Gate
// ============================
const showProfileModal = ref(false)
const showBecomeOrganizerModal = ref(false)
const organizerForm = ref({ spaceName: '', organizerName: '' })
const organizerError = ref('')

const isAuthenticated = computed(() => userStore.isProfileComplete)
const isOrganizer = computed(() => userStore.isOrganizer)

// Vérifier l'auth au montage
onMounted(async () => {
  if (!isAuthenticated.value) {
    showProfileModal.value = true
    return
  }
  if (!isOrganizer.value) {
    showBecomeOrganizerModal.value = true
    return
  }
  await eventStore.loadEvents()
  await userStore.loadActivePass()
})

const handleProfileCreated = async () => {
  showProfileModal.value = false
  if (!userStore.isOrganizer) {
    showBecomeOrganizerModal.value = true
  } else {
    await eventStore.loadEvents()
    await userStore.loadActivePass()
  }
}

const handleBecomeOrganizer = async () => {
  organizerError.value = ''
  if (!organizerForm.value.spaceName.trim()) {
    organizerError.value = 'Le nom de votre espace est requis'
    return
  }
  const success = await userStore.becomeOrganizer({
    spaceName: organizerForm.value.spaceName,
    organizerName: organizerForm.value.organizerName || userStore.user?.name || ''
  })
  if (success) {
    showBecomeOrganizerModal.value = false
    await eventStore.loadEvents()
    await userStore.loadActivePass()
  } else {
    organizerError.value = 'Erreur lors de la création de votre espace'
  }
}

// ============================
// Events - Filtrés par organisateur
// ============================
const statusFilter = ref('all')
const deleteConfirmId = ref(null)

const myEvents = computed(() => {
  const u = userStore.user
  if (!u) return []
  const names = [u.organizerName, u.spaceName, u.name].filter(Boolean).map(n => n.toLowerCase())
  return eventStore.events.filter(e => {
    if (e.createdBy && u.id && e.createdBy === u.id) return true
    const orgName = (e.organizer || '').toLowerCase()
    return names.some(n => orgName === n || orgName.includes(n))
  })
})

const filteredEvents = computed(() => {
  let list = [...myEvents.value]
  if (statusFilter.value !== 'all') {
    if (statusFilter.value === 'approved') {
      list = list.filter(e => !e.status || e.status === 'approved')
    } else {
      list = list.filter(e => e.status === statusFilter.value)
    }
  }
  return list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
})

// ============================
// Compteurs par status
// ============================
const statusCounts = computed(() => ({
  all: myEvents.value.length,
  pending: myEvents.value.filter(e => e.status === 'pending').length,
  approved: myEvents.value.filter(e => !e.status || e.status === 'approved').length,
  rejected: myEvents.value.filter(e => e.status === 'rejected').length
}))

// ============================
// Quota Publications Gratuites (5 max)
// ============================
const FREE_PUBLICATION_LIMIT = 5

const freePublicationsRemaining = computed(() => {
  return Math.max(0, FREE_PUBLICATION_LIMIT - myEvents.value.length)
})

const hasReachedQuota = computed(() => {
  if (userStore.hasActivePass) return false
  return myEvents.value.length >= FREE_PUBLICATION_LIMIT
})

// ============================
// Actions
// ============================
const handleCreateEvent = () => {
  if (hasReachedQuota.value) return
  router.push('/pro/create')
}

const handleDeleteEvent = async (id) => {
  await eventStore.deleteEvent(id)
  deleteConfirmId.value = null
}

const getStatusBadge = (status) => {
  switch (status) {
    case 'pending': return { text: 'En attente', class: 'bg-yellow-500/20 text-yellow-400', icon: Clock }
    case 'rejected': return { text: 'Refusé', class: 'bg-red-500/20 text-red-400', icon: ShieldX }
    default: return { text: 'Approuvé', class: 'bg-green-500/20 text-green-400', icon: ShieldCheck }
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="min-h-screen bg-black">
    <!-- Bandeau de connexion -->
    <ConnectionBanner :showOfflineBanner="showOfflineBanner" :showReconnectBanner="showReconnectBanner" :isSyncing="isSyncing" />

    <!-- Auth Gate : Modale profil si non connecté -->
    <UserProfileModal v-if="showProfileModal" @profile-created="handleProfileCreated" />

    <!-- Modale Devenir Organisateur -->
    <Teleport to="body">
      <div v-if="showBecomeOrganizerModal && !showProfileModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div class="bg-gray-900 rounded-2xl w-full max-w-md p-6 border border-gray-800">
          <div class="text-center mb-6">
            <Store class="w-12 h-12 text-primary mx-auto mb-3" />
            <h2 class="text-2xl font-bold text-white mb-1">Devenir Organisateur</h2>
            <p class="text-gray-400 text-sm">Créez votre espace pour publier des événements</p>
          </div>
          <form @submit.prevent="handleBecomeOrganizer" class="space-y-4">
            <div>
              <label class="block text-gray-400 text-sm mb-1">Nom de votre espace *</label>
              <input
                v-model="organizerForm.spaceName"
                type="text"
                placeholder="Ex: Le Balafon Lounge, Espace VIP..."
                class="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
              />
            </div>
            <div>
              <label class="block text-gray-400 text-sm mb-1">Nom de l'organisateur</label>
              <input
                v-model="organizerForm.organizerName"
                type="text"
                :placeholder="userStore.user?.name || 'Votre nom'"
                class="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
              />
            </div>
            <div v-if="organizerError" class="bg-red-900/20 text-red-400 text-sm p-3 rounded-xl text-center">
              {{ organizerError }}
            </div>
            <button type="submit" :disabled="userStore.isLoading" class="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary/90 transition flex items-center justify-center gap-2">
              <Loader2 v-if="userStore.isLoading" class="w-5 h-5 animate-spin" />
              <span v-else>Créer mon espace 🚀</span>
            </button>
          </form>
          <button @click="router.push('/')" class="w-full text-gray-500 text-sm mt-4 hover:text-white transition">
            Retour à l'accueil
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Dashboard principal (visible uniquement si organisateur) -->
    <template v-if="isAuthenticated && isOrganizer">
      <!-- Header sticky -->
      <header class="bg-surface border-b border-gray-800 px-4 py-3 sticky top-0 z-40">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
          <div class="flex items-center gap-3">
            <Store class="w-5 h-5 text-primary" />
            <div>
              <h1 class="text-xl font-bold text-primary">{{ userStore.user?.spaceName || 'Mon Espace' }}</h1>
              <p class="text-xs text-gray-400">{{ userStore.user?.organizerName || userStore.user?.name }}</p>
            </div>
          </div>
          <router-link to="/" class="text-gray-400 text-sm hover:text-white transition flex items-center gap-1">
            <ArrowLeft class="w-4 h-4" />
            Retour
          </router-link>
        </div>
      </header>

      <main class="max-w-6xl mx-auto p-4">
        <!-- Grille Stats (4 cards) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div class="bg-surface border border-gray-800 rounded-xl p-4 text-center">
            <p class="text-2xl font-bold text-primary">{{ statusCounts.all }}</p>
            <p class="text-gray-500 text-xs mt-1">Total</p>
          </div>
          <div class="bg-surface border border-gray-800 rounded-xl p-4 text-center">
            <p class="text-2xl font-bold text-green-400">{{ statusCounts.approved }}</p>
            <p class="text-gray-500 text-xs mt-1">Approuvés</p>
          </div>
          <div class="bg-surface border border-gray-800 rounded-xl p-4 text-center">
            <p class="text-2xl font-bold text-yellow-400">{{ statusCounts.pending }}</p>
            <p class="text-gray-500 text-xs mt-1">En attente</p>
          </div>
          <div class="bg-surface border border-gray-800 rounded-xl p-4 text-center">
            <p class="text-2xl font-bold text-red-400">{{ statusCounts.rejected }}</p>
            <p class="text-gray-500 text-xs mt-1">Refusés</p>
          </div>
        </div>

        <!-- Bandeau Quota -->
        <div class="mb-6 rounded-xl p-4 border flex items-center justify-between gap-3"
          :class="hasReachedQuota ? 'bg-red-900/20 border-red-800' : 'bg-surface border-gray-800'">
          <div class="flex items-center gap-3">
            <Ticket class="w-5 h-5" :class="hasReachedQuota ? 'text-red-400' : 'text-primary'" />
            <div>
              <p class="text-sm font-medium" :class="hasReachedQuota ? 'text-red-400' : 'text-white'">
                <template v-if="userStore.hasActivePass">
                  <Crown class="w-4 h-4 inline text-yellow-400" /> Publications illimitées
                </template>
                <template v-else-if="hasReachedQuota">
                  Quota atteint ({{ FREE_PUBLICATION_LIMIT }}/{{ FREE_PUBLICATION_LIMIT }})
                </template>
                <template v-else>
                  {{ freePublicationsRemaining }} publication{{ freePublicationsRemaining > 1 ? 's' : '' }} gratuite{{ freePublicationsRemaining > 1 ? 's' : '' }} restante{{ freePublicationsRemaining > 1 ? 's' : '' }}
                </template>
              </p>
              <p v-if="!userStore.hasActivePass" class="text-gray-500 text-xs mt-0.5">
                {{ hasReachedQuota ? 'Passez à un abonnement pour publier plus' : `${myEvents.length}/${FREE_PUBLICATION_LIMIT} utilisées` }}
              </p>
            </div>
          </div>
          <router-link v-if="!userStore.hasActivePass" to="/" class="bg-primary text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition whitespace-nowrap">
            Obtenir un Pass
          </router-link>
        </div>

        <!-- Boutons d'action -->
        <div class="flex gap-3 mb-6">
          <button
            @click="handleCreateEvent"
            :disabled="hasReachedQuota"
            class="flex-1 bg-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus class="w-5 h-5" />
            Nouvel Événement
          </button>
          <router-link to="/admin/ads" class="bg-yellow-400 text-black font-bold py-3 px-5 rounded-xl flex items-center gap-2 hover:bg-yellow-500 transition">
            <Megaphone class="w-5 h-5" />
            Publicités
          </router-link>
        </div>

        <!-- Onglets filtre status -->
        <div class="flex gap-2 mb-6 overflow-x-auto pb-1">
          <button
            v-for="filter in [
              { key: 'all', label: 'Tous', count: statusCounts.all },
              { key: 'approved', label: 'Approuvés', count: statusCounts.approved },
              { key: 'pending', label: 'En attente', count: statusCounts.pending },
              { key: 'rejected', label: 'Refusés', count: statusCounts.rejected }
            ]"
            :key="filter.key"
            @click="statusFilter = filter.key"
            class="px-4 py-2 rounded-full text-sm font-medium transition whitespace-nowrap flex items-center gap-1.5"
            :class="statusFilter === filter.key ? 'bg-primary text-black' : 'bg-surface text-gray-400 hover:text-white border border-gray-800'"
          >
            {{ filter.label }}
            <span class="text-xs opacity-70">({{ filter.count }})</span>
          </button>
        </div>

        <!-- Loading -->
        <div v-if="eventStore.isLoading" class="text-center py-16">
          <Loader2 class="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p class="text-gray-400 animate-pulse">Chargement...</p>
        </div>

        <!-- Grille de cards events -->
        <div v-else-if="filteredEvents.length > 0" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="event in filteredEvents"
            :key="event.id"
            class="bg-surface rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition"
          >
            <!-- Image -->
            <div class="relative h-40 bg-gray-900">
              <img v-if="event.image" :src="event.image" :alt="event.title" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Calendar class="w-10 h-10 text-gray-700" />
              </div>
              <!-- Badge status -->
              <div class="absolute top-2 left-2">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1" :class="getStatusBadge(event.status).class">
                  <component :is="getStatusBadge(event.status).icon" class="w-3 h-3" />
                  {{ getStatusBadge(event.status).text }}
                </span>
              </div>
            </div>

            <!-- Infos -->
            <div class="p-4">
              <h3 class="font-bold text-white text-sm line-clamp-1 mb-1">{{ event.title }}</h3>
              <div class="flex items-center gap-1 text-gray-400 text-xs mb-1">
                <Calendar class="w-3 h-3" />
                {{ formatDate(event.date) }}
              </div>
              <div v-if="event.location" class="flex items-center gap-1 text-gray-500 text-xs mb-3">
                <MapPin class="w-3 h-3" />
                <span class="line-clamp-1">{{ event.location }}</span>
              </div>

              <!-- Raison de rejet -->
              <div v-if="event.status === 'rejected' && event.rejectionReason" class="bg-red-900/20 text-red-400 text-xs p-2 rounded-lg mb-3 flex items-start gap-1.5">
                <AlertTriangle class="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{{ event.rejectionReason }}</span>
              </div>

              <!-- Actions -->
              <div class="flex gap-2">
                <button
                  v-if="deleteConfirmId !== event.id"
                  @click="deleteConfirmId = event.id"
                  class="flex-1 bg-red-500/20 text-red-400 py-2 rounded-lg text-sm font-medium hover:bg-red-500/30 transition flex items-center justify-center gap-1"
                >
                  <Trash2 class="w-4 h-4" />
                  Supprimer
                </button>
                <div v-else class="flex-1 flex gap-1">
                  <button @click="handleDeleteEvent(event.id)" class="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1">
                    <Check class="w-4 h-4" /> Confirmer
                  </button>
                  <button @click="deleteConfirmId = null" class="bg-gray-700 text-white px-3 py-2 rounded-lg">
                    <X class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- État vide avec CTA -->
        <div v-else class="text-center py-16">
          <Calendar class="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p class="text-gray-400 text-lg mb-2">
            {{ statusFilter === 'all' ? 'Aucun événement' : 'Aucun événement dans cette catégorie' }}
          </p>
          <p class="text-gray-600 text-sm mb-6">Créez votre premier événement pour le voir apparaître ici</p>
          <button
            v-if="!hasReachedQuota"
            @click="handleCreateEvent"
            class="bg-primary text-black font-bold px-6 py-3 rounded-xl inline-flex items-center gap-2 hover:bg-primary/90 transition"
          >
            <Plus class="w-5 h-5" />
            Créer un événement
          </button>
        </div>
      </main>
    </template>
  </div>
</template>
