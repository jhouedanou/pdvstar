<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { useConnectionStatus } from '../composables/useConnectionStatus'
import ConnectionBanner from '../components/ConnectionBanner.vue'
import ProLoginModal from '../components/ProLoginModal.vue'
import {
  ArrowLeft, Plus, Edit, Trash2, Calendar, MapPin,
  Check, X, Loader2, Store, Megaphone, Clock,
  ShieldCheck, ShieldX, AlertTriangle, Ticket, Crown, ScanLine, Users, Phone, MessageCircle, LogOut,
  Menu, Home, QrCode, LayoutDashboard, Bell, BellRing, Share2, Copy, MessageSquare
} from 'lucide-vue-next'
import { PASS_CATALOG } from '../services/supabase'
import { fetchEventStats } from '../services/statsService'
import { listRsvpsForEvent } from '../services/rsvpService'
import { fetchTicketsForEvent } from '../services/ticketService'
import { sendWhatsAppMessage } from '../services/greenApiService'
import { fetchOrganizerNotifications } from '../services/notificationsService'

const router = useRouter()
const eventStore = useEventStore()
const userStore = useUserStore()
const { isOnline, isSyncing, showOfflineBanner, showReconnectBanner } = useConnectionStatus()

// ============================
// Auth Gate
// ============================
const showProLoginModal = ref(false)
const showMobileMenu = ref(false)

const isAuthenticated = computed(() => userStore.isProfileComplete)
const isOrganizer = computed(() => userStore.isOrganizer)

// Vérifier l'auth au montage
onMounted(async () => {
  if (!isAuthenticated.value || !isOrganizer.value) { showProLoginModal.value = true; return }
  await eventStore.loadEvents()
  await userStore.loadActivePass()
  // Compter followers
  try {
    const { supabase } = await import('../services/supabase')
    const names = [userStore.user?.organizerName, userStore.user?.spaceName, userStore.user?.name].filter(Boolean)
    if (names.length) {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .overlaps('following', names)
      followersCount.value = count || 0
    }
  } catch {}
})

const handleProAuthenticated = async () => {
  showProLoginModal.value = false
  await eventStore.loadEvents()
  await userStore.loadActivePass()
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

// Followers : users qui suivent l'organisateur
const followersCount = ref(0)
const followersList = ref([])
const showFollowersModal = ref(false)
const loadingFollowers = ref(false)

const loadFollowers = async () => {
  if (loadingFollowers.value) return
  loadingFollowers.value = true
  try {
    const { supabase } = await import('../services/supabase')
    const names = [userStore.user?.organizerName, userStore.user?.spaceName, userStore.user?.name].filter(Boolean)
    if (!names.length) {
      followersList.value = []
      return
    }
    const { data } = await supabase
      .from('users')
      .select('id, name, pseudo, phone, avatar, avatar_url, following')
      .overlaps('following', names)
      .order('created_at', { ascending: false })
    followersList.value = data || []
    followersCount.value = followersList.value.length
  } catch (e) {
    console.error('loadFollowers error:', e)
  } finally {
    loadingFollowers.value = false
  }
}

const openFollowers = async () => {
  showFollowersModal.value = true
  await loadFollowers()
}

const contactFollower = async (f) => {
  if (!f.phone) return
  const organizerName = userStore.user?.organizerName || userStore.user?.spaceName || userStore.user?.name || "L'organisateur"
  const msg = `Bonjour ${f.pseudo || f.name || f.phone} 👋\n\n${organizerName} vous remercie pour votre abonnement et vous tient informé des prochains événements !`
  try {
    await sendWhatsAppMessage(f.phone, msg)
    alert(`Message envoyé à ${f.pseudo || f.name || f.phone} !`)
  } catch (e) {
    alert(`Échec : ${e.message}`)
  }
}

const selectStatusFilter = (status) => {
  statusFilter.value = status
  activeTab.value = 'events'
  // scroll to events section
  setTimeout(() => {
    document.getElementById('events-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 50)
}

// Onglet actif : 'events' | 'participants'
const activeTab = ref('events')

// Liste des participants (RSVP toutes mes événements confondues)
const participants = ref([])
const loadingParticipants = ref(false)
const contactingSendingTo = ref(null)

const loadParticipants = async () => {
  if (loadingParticipants.value) return
  loadingParticipants.value = true
  try {
    const results = []
    for (const event of myEvents.value) {
      const rsvps = await listRsvpsForEvent(event.id)
      rsvps.forEach(r => results.push({ ...r, eventTitle: event.title, eventDate: event.date }))
    }
    // Dédupliquer par phone + eventId
    const seen = new Set()
    participants.value = results.filter(r => {
      const key = `${r.event_id || r.eventId}:${r.phone}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  } catch (e) {
    console.error('loadParticipants error:', e)
  } finally {
    loadingParticipants.value = false
  }
}

const contactParticipant = async (p) => {
  if (!p.phone) return
  contactingSendingTo.value = p.phone
  const organizerName = userStore.user?.organizerName || userStore.user?.spaceName || userStore.user?.name || 'L\'organisateur'
  const msg = `Bonjour ${p.pseudo || p.phone} 👋\n\nMessage de ${organizerName} concernant l\'événement : ${p.eventTitle || ''}\n\nMerci pour votre intérêt !`
  try {
    await sendWhatsAppMessage(p.phone, msg)
    alert(`Message envoyé à ${p.pseudo || p.phone} !`)
  } catch (e) {
    alert(`Échec : ${e.message}`)
  } finally {
    contactingSendingTo.value = null
  }
}

// Stats par event (RSVP + tickets) - chargé à la demande
const eventStats = ref({})  // { [eventId]: { rsvpCount, ticketsSold, revenue, ... } }
const loadStatsFor = async (eventId) => {
  if (eventStats.value[eventId]) return
  const s = await fetchEventStats(eventId)
  eventStats.value = { ...eventStats.value, [eventId]: s }
}

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
  router.push('/organizer/events/new')
}

const handleDeleteEvent = async (id) => {
  await eventStore.deleteEvent(id)
  deleteConfirmId.value = null
}

// ============================
// Notifications
// ============================
const notifications = ref([])
const loadingNotifs = ref(false)
const loadNotifications = async () => {
  if (loadingNotifs.value) return
  loadingNotifs.value = true
  try {
    notifications.value = await fetchOrganizerNotifications(myEvents.value)
  } catch (e) {
    console.error('Erreur load notifs', e)
  } finally {
    loadingNotifs.value = false
  }
}

const formatTimeAgo = (ts) => {
  if (!ts) return ''
  const diffMs = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `il y a ${hrs}h`
  const days = Math.floor(hrs / 24)
  return `il y a ${days}j`
}

// ============================
// Reminders
// ============================
const sendingReminderEventId = ref(null)
const reminderStatus = ref('')

const sendReminderForEvent = async (event) => {
  if (sendingReminderEventId.value) return
  sendingReminderEventId.value = event.id
  reminderStatus.value = ''
  try {
    const rsvps = await listRsvpsForEvent(event.id)
    if (!rsvps.length) {
      reminderStatus.value = `Aucun participant à notifier pour "${event.title}".`
      return
    }
    const dateStr = event.date ? new Date(event.date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''
    const organizer = userStore.user?.organizerName || userStore.user?.spaceName || userStore.user?.name || 'L\'organisateur'
    const message = `Rappel — ${event.title}\n\nC'est bientôt ! ${dateStr ? `Rendez-vous : ${dateStr}` : ''}\nLieu : ${event.location || 'Voir l\'application'}\n\nDe la part de ${organizer}\n\n— Babi Vibes`

    let sent = 0
    let failed = 0
    for (const r of rsvps) {
      if (!r.phone) continue
      try {
        await sendWhatsAppMessage(r.phone, message)
        sent++
      } catch {
        failed++
      }
    }
    reminderStatus.value = `Rappel envoyé : ${sent} reçu${sent > 1 ? 's' : ''}${failed > 0 ? `, ${failed} échec${failed > 1 ? 's' : ''}` : ''}.`
  } catch (e) {
    reminderStatus.value = `Erreur : ${e.message || 'inconnue'}`
  } finally {
    sendingReminderEventId.value = null
    setTimeout(() => { reminderStatus.value = '' }, 5000)
  }
}

// ============================
// Partage event approuvé
// ============================
const shareStatus = ref({}) // { [eventId]: 'copied' | 'shared' | 'error' }

const buildEventShareUrl = (event) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/billet/${event.id}`
}

const buildEventShareText = (event) => {
  const dateStr = event.date ? new Date(event.date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''
  const lieu = event.location ? ` à ${event.location}` : ''
  const quand = dateStr ? ` le ${dateStr}` : ''
  return `${event.title}${quand}${lieu}. Réserve ta place sur Babi Vibes :`
}

const setShareStatus = (eventId, status) => {
  shareStatus.value = { ...shareStatus.value, [eventId]: status }
  setTimeout(() => {
    const next = { ...shareStatus.value }
    delete next[eventId]
    shareStatus.value = next
  }, 2500)
}

const shareEventLink = async (event) => {
  const url = buildEventShareUrl(event)
  const text = buildEventShareText(event)
  try {
    if (navigator.share) {
      await navigator.share({ title: event.title, text, url })
      setShareStatus(event.id, 'shared')
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setShareStatus(event.id, 'copied')
    }
  } catch (e) {
    if (e?.name === 'AbortError') return
    setShareStatus(event.id, 'error')
  }
}

const copyEventLink = async (event) => {
  try {
    await navigator.clipboard.writeText(buildEventShareUrl(event))
    setShareStatus(event.id, 'copied')
  } catch {
    setShareStatus(event.id, 'error')
  }
}

const shareEventWhatsApp = (event) => {
  const url = buildEventShareUrl(event)
  const text = `${buildEventShareText(event)} ${url}`
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}

// ============================
// Billetterie
// ============================
const billetterieData = ref([]) // [{ event, tickets, rsvps, categories }]
const loadingBilletterie = ref(false)
const editingCategories = ref(null) // eventId en cours d'édition
const newCatForm = ref({ name: '', capacity: '', price: '' })

const loadBilletterie = async () => {
  if (loadingBilletterie.value) return
  loadingBilletterie.value = true
  try {
    const results = []
    for (const event of myEvents.value) {
      const [tickets, rsvps] = await Promise.all([
        fetchTicketsForEvent(event.id),
        listRsvpsForEvent(event.id)
      ])
      const categories = event.ticketCategories
        ? (typeof event.ticketCategories === 'string' ? JSON.parse(event.ticketCategories) : event.ticketCategories)
        : []
      results.push({ event, tickets, rsvps, categories })
    }
    billetterieData.value = results
  } finally {
    loadingBilletterie.value = false
  }
}

const getTicketStats = (tickets) => ({
  total: tickets.length,
  valid: tickets.filter(t => t.status === 'valid' && t.payment_status === 'paid').length,
  used: tickets.filter(t => t.status === 'used').length,
  pending: tickets.filter(t => t.payment_status === 'pending').length,
  revenue: tickets.filter(t => t.payment_status === 'paid').reduce((s, t) => s + (t.price || 0), 0)
})

const addCategory = async (item) => {
  const name = newCatForm.value.name.trim()
  const capacity = parseInt(newCatForm.value.capacity) || 0
  const price = parseInt(newCatForm.value.price) || 0
  if (!name || !capacity) return

  const cats = [...(item.categories || []), {
    id: crypto.randomUUID(),
    name,
    capacity,
    price
  }]
  await eventStore.updateEvent(item.event.id, { ticketCategories: JSON.stringify(cats) })
  item.categories = cats
  newCatForm.value = { name: '', capacity: '', price: '' }
  editingCategories.value = null
}

const removeCategory = async (item, catId) => {
  const cats = (item.categories || []).filter(c => c.id !== catId)
  await eventStore.updateEvent(item.event.id, { ticketCategories: JSON.stringify(cats) })
  item.categories = cats
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

    <!-- Auth Gate Pro : login ou création compte organisateur -->
    <ProLoginModal v-if="showProLoginModal" @authenticated="handleProAuthenticated" />

    <!-- Dashboard principal (visible uniquement si organisateur) -->
    <template v-if="isAuthenticated && isOrganizer">
      <!-- Mobile menu drawer -->
      <Teleport to="body">
        <div v-if="showMobileMenu" class="fixed inset-0 z-50 flex">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showMobileMenu = false" />
          <div class="relative w-72 max-w-[85vw] bg-gray-900 h-full flex flex-col shadow-2xl border-r border-gray-800">
            <div class="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div class="flex items-center gap-2">
                <Store class="w-5 h-5 text-primary" />
                <div>
                  <p class="font-bold text-white text-sm">{{ userStore.user?.spaceName || 'Mon Espace' }}</p>
                  <p class="text-xs text-gray-400">{{ userStore.user?.organizerName || userStore.user?.name }}</p>
                </div>
              </div>
              <button @click="showMobileMenu = false" class="text-gray-400 hover:text-white transition">
                <X class="w-5 h-5" />
              </button>
            </div>

            <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              <button @click="showMobileMenu = false; router.push('/pro')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition text-left">
                <LayoutDashboard class="w-4 h-4 text-primary" />
                Mon Espace
              </button>
              <button @click="showMobileMenu = false; router.push('/pro/create')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition text-left">
                <Plus class="w-4 h-4 text-green-400" />
                Créer un événement
              </button>
              <button @click="showMobileMenu = false; router.push('/organizer/ads')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition text-left">
                <Megaphone class="w-4 h-4 text-yellow-400" />
                Publicités
              </button>
              <button @click="showMobileMenu = false; router.push('/billet/scan')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition text-left">
                <ScanLine class="w-4 h-4 text-blue-400" />
                Scanner billets
              </button>
              <button @click="showMobileMenu = false; router.push('/')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition text-left">
                <Home class="w-4 h-4" />
                Retour à l'accueil
              </button>
            </nav>

            <div class="border-t border-gray-800 p-3">
              <button
                @click="showMobileMenu = false; userStore.logout(); router.push('/')"
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition"
              >
                <LogOut class="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Header sticky -->
      <header class="bg-surface border-b border-gray-800 px-4 py-3 sticky top-0 z-40">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
          <div class="flex items-center gap-3">
            <button @click="showMobileMenu = true" class="text-gray-400 hover:text-white transition p-1 -ml-1" aria-label="Menu">
              <Menu class="w-5 h-5" />
            </button>
            <div>
              <h1 class="text-base font-bold text-primary leading-tight">{{ userStore.user?.spaceName || 'Mon Espace' }}</h1>
              <p class="text-xs text-gray-400">{{ userStore.user?.organizerName || userStore.user?.name }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button @click="router.push('/pro/create')" class="text-gray-400 hover:text-primary transition" title="Créer un événement">
              <Plus class="w-5 h-5" />
            </button>
            <button
              @click="userStore.logout(); router.push('/')"
              class="flex items-center gap-1 text-xs text-gray-400 hover:text-red-400 transition px-2 py-1.5 rounded-lg hover:bg-red-500/10"
              title="Se déconnecter"
            >
              <LogOut class="w-4 h-4" />
              <span class="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Toast statut reminder -->
      <Transition name="slide-down">
        <div v-if="reminderStatus" class="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-orange-500 text-black font-bold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 max-w-md">
          <BellRing class="w-5 h-5" />
          <span class="text-sm">{{ reminderStatus }}</span>
        </div>
      </Transition>

      <main class="max-w-6xl mx-auto p-4">
        <!-- Grille Stats -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <button @click="selectStatusFilter('all')"
            class="bg-surface border rounded-xl p-4 text-center transition hover:scale-105 hover:border-primary/60"
            :class="statusFilter === 'all' ? 'border-primary' : 'border-gray-800'">
            <p class="text-2xl font-bold text-primary">{{ statusCounts.all }}</p>
            <p class="text-gray-500 text-xs mt-1">Événements</p>
          </button>
          <button @click="selectStatusFilter('approved')"
            class="bg-surface border rounded-xl p-4 text-center transition hover:scale-105 hover:border-green-500/60"
            :class="statusFilter === 'approved' ? 'border-green-500' : 'border-gray-800'">
            <p class="text-2xl font-bold text-green-400">{{ statusCounts.approved }}</p>
            <p class="text-gray-500 text-xs mt-1">Approuvés</p>
          </button>
          <button @click="selectStatusFilter('pending')"
            class="bg-surface border rounded-xl p-4 text-center transition hover:scale-105 hover:border-yellow-500/60"
            :class="statusFilter === 'pending' ? 'border-yellow-500' : 'border-gray-800'">
            <p class="text-2xl font-bold text-yellow-400">{{ statusCounts.pending }}</p>
            <p class="text-gray-500 text-xs mt-1">En attente</p>
          </button>
          <button @click="selectStatusFilter('rejected')"
            class="bg-surface border rounded-xl p-4 text-center transition hover:scale-105 hover:border-red-500/60"
            :class="statusFilter === 'rejected' ? 'border-red-500' : 'border-gray-800'">
            <p class="text-2xl font-bold text-red-400">{{ statusCounts.rejected }}</p>
            <p class="text-gray-500 text-xs mt-1">Refusés</p>
          </button>
          <button @click="openFollowers()"
            class="bg-surface border border-gray-800 rounded-xl p-4 text-center transition hover:scale-105 hover:border-blue-500/60">
            <p class="text-2xl font-bold text-blue-400">{{ followersCount }}</p>
            <p class="text-gray-500 text-xs mt-1">Abonnés</p>
          </button>
        </div>

        <!-- Bandeau Quota -->
        <div class="mb-6 rounded-xl p-4 border flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"
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
          <router-link v-if="!userStore.hasActivePass" to="/" class="bg-primary text-black text-xs font-bold px-3 py-2 rounded-lg hover:bg-primary/90 transition text-center whitespace-nowrap">
            Obtenir un Pass
          </router-link>
        </div>

        <!-- Boutons d'action -->
        <div class="grid grid-cols-2 gap-3 mb-6 sm:flex">
          <button
            @click="handleCreateEvent"
            :disabled="hasReachedQuota"
            class="col-span-2 sm:col-span-1 sm:flex-1 bg-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus class="w-5 h-5" />
            Nouvel Événement
          </button>
          <router-link to="/organizer/ads" class="bg-yellow-400 text-black font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-500 transition">
            <Megaphone class="w-5 h-5" />
            Publicités
          </router-link>
          <button @click="router.push('/billet/scan')" class="bg-purple-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-purple-600 transition">
            <ScanLine class="w-5 h-5" />
            Scan
          </button>
        </div>

        <!-- Onglets principaux -->
        <div class="flex gap-2 mb-6 border-b border-gray-800 overflow-x-auto">
          <button @click="activeTab = 'events'" :class="activeTab === 'events' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'"
            class="pb-3 px-1 text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap">
            <Calendar class="w-4 h-4" /> Événements
          </button>
          <button @click="activeTab = 'participants'; loadParticipants()" :class="activeTab === 'participants' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'"
            class="pb-3 px-1 text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap">
            <Users class="w-4 h-4" /> Participants
            <span v-if="participants.length" class="text-xs bg-primary/20 text-primary rounded-full px-1.5">{{ participants.length }}</span>
          </button>
          <button @click="activeTab = 'billetterie'; loadBilletterie()" :class="activeTab === 'billetterie' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'"
            class="pb-3 px-1 text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap">
            <Ticket class="w-4 h-4" /> Billetterie
          </button>
          <button @click="activeTab = 'notifs'; loadNotifications()" :class="activeTab === 'notifs' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'"
            class="pb-3 px-1 text-sm font-medium transition flex items-center gap-1.5 whitespace-nowrap">
            <Bell class="w-4 h-4" /> Notifications
            <span v-if="notifications.length" class="text-xs bg-orange-500/20 text-orange-400 rounded-full px-1.5">{{ notifications.length }}</span>
          </button>
        </div>

        <!-- === TAB EVENTS === -->
        <template v-if="activeTab === 'events'">
        <!-- Onglets filtre status -->
        <div id="events-section" class="flex gap-2 mb-6 overflow-x-auto pb-1">
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

              <!-- Stats event -->
              <div class="flex gap-2 mb-3" @mouseenter="loadStatsFor(event.id)">
                <button @click="loadStatsFor(event.id)" class="flex-1 bg-gray-800 text-gray-300 px-2 py-1.5 rounded-lg text-xs flex items-center justify-center gap-1">
                  <Users class="w-3 h-3" />
                  <span v-if="eventStats[event.id]">{{ eventStats[event.id].rsvpCount }} RSVP · {{ eventStats[event.id].ticketsSold }} billets</span>
                  <span v-else>Voir stats</span>
                </button>
              </div>
              <div v-if="eventStats[event.id]?.revenue" class="text-xs text-green-400 mb-2">
                {{ eventStats[event.id].revenue }} CFA - commission {{ eventStats[event.id].commission }}
              </div>

              <!-- Partage (event approuvé uniquement) -->
              <div v-if="event.status === 'approved' || !event.status" class="mb-2">
                <div class="bg-gray-900/60 border border-gray-800 rounded-lg p-2">
                  <div class="flex items-center justify-between gap-2 mb-1.5">
                    <span class="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">
                      <Share2 class="w-3 h-3" /> Lien de partage
                    </span>
                    <span v-if="shareStatus[event.id] === 'copied'" class="text-[10px] text-green-400">Lien copié</span>
                    <span v-else-if="shareStatus[event.id] === 'shared'" class="text-[10px] text-green-400">Partagé</span>
                    <span v-else-if="shareStatus[event.id] === 'error'" class="text-[10px] text-red-400">Erreur</span>
                  </div>
                  <div class="flex items-center gap-1.5 mb-1.5">
                    <input
                      :value="buildEventShareUrl(event)"
                      readonly
                      @focus="$event.target.select()"
                      class="flex-1 bg-black/50 text-gray-300 text-[11px] px-2 py-1.5 rounded border border-gray-800 truncate"
                    />
                  </div>
                  <div class="grid grid-cols-3 gap-1.5">
                    <button
                      @click="shareEventLink(event)"
                      class="bg-primary/20 text-primary py-1.5 rounded text-[11px] font-medium hover:bg-primary/30 transition flex items-center justify-center gap-1"
                      title="Partager"
                    >
                      <Share2 class="w-3 h-3" /> Partager
                    </button>
                    <button
                      @click="copyEventLink(event)"
                      class="bg-gray-800 text-gray-200 py-1.5 rounded text-[11px] font-medium hover:bg-gray-700 transition flex items-center justify-center gap-1"
                      title="Copier le lien"
                    >
                      <Copy class="w-3 h-3" /> Copier
                    </button>
                    <button
                      @click="shareEventWhatsApp(event)"
                      class="bg-green-500/20 text-green-400 py-1.5 rounded text-[11px] font-medium hover:bg-green-500/30 transition flex items-center justify-center gap-1"
                      title="Partager via WhatsApp"
                    >
                      <MessageSquare class="w-3 h-3" /> WhatsApp
                    </button>
                  </div>
                </div>
              </div>

              <!-- Actions secondaires -->
              <div class="grid grid-cols-2 gap-2 mb-2">
                <button
                  v-if="event.status === 'approved' || !event.status"
                  @click="router.push(`/billet/scan/${event.id}`)"
                  class="bg-purple-500/20 text-purple-400 py-2 rounded-lg text-xs font-medium hover:bg-purple-500/30 transition flex items-center justify-center gap-1"
                >
                  <ScanLine class="w-3.5 h-3.5" />
                  Scanner
                </button>
                <button
                  v-if="event.status === 'approved' || !event.status"
                  @click="sendReminderForEvent(event)"
                  :disabled="sendingReminderEventId === event.id"
                  class="bg-orange-500/20 text-orange-400 py-2 rounded-lg text-xs font-medium hover:bg-orange-500/30 transition flex items-center justify-center gap-1 disabled:opacity-50"
                  :title="`Envoyer un rappel WhatsApp à tous les participants de ${event.title}`"
                >
                  <Loader2 v-if="sendingReminderEventId === event.id" class="w-3.5 h-3.5 animate-spin" />
                  <BellRing v-else class="w-3.5 h-3.5" />
                  Rappel
                </button>
              </div>
              <div class="flex gap-2">
                <button
                  @click="router.push(`/organizer/events/${event.id}`)"
                  class="flex-1 bg-gray-800 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition flex items-center justify-center gap-1"
                >
                  Details
                </button>
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
        </template><!-- fin TAB EVENTS -->

        <!-- === TAB PARTICIPANTS === -->
        <template v-if="activeTab === 'participants'">
          <div v-if="loadingParticipants" class="text-center py-16">
            <Loader2 class="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
            <p class="text-gray-400 text-sm">Chargement des participants...</p>
          </div>
          <div v-else-if="!participants.length" class="text-center py-16">
            <Users class="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p class="text-gray-400 text-lg mb-1">Aucun participant pour l'instant</p>
            <p class="text-gray-600 text-sm">Les personnes qui cliquent "J'y vais" apparaissent ici</p>
          </div>
          <div v-else class="space-y-3">
            <p class="text-gray-500 text-xs mb-3">{{ participants.length }} participant(s) au total sur tous vos événements</p>
            <div v-for="p in participants" :key="`${p.event_id || p.eventId}:${p.phone}`"
              class="bg-surface border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-3">
              <div class="flex-1 min-w-0">
                <p class="font-medium text-white text-sm">{{ p.pseudo || p.phone }}</p>
                <p class="text-gray-400 text-xs flex items-center gap-1 mt-0.5">
                  <Phone class="w-3 h-3" /> {{ p.phone }}
                </p>
                <p class="text-primary text-xs line-clamp-1 mt-0.5">{{ p.eventTitle }}</p>
                <p class="text-gray-600 text-xs">{{ p.city || '' }}{{ p.city && p.district ? ' · ' : '' }}{{ p.district || '' }}</p>
                <p class="text-gray-700 text-[10px] mt-0.5">{{ p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '' }}</p>
              </div>
              <button
                @click="contactParticipant(p)"
                :disabled="contactingSendingTo === p.phone"
                class="flex-shrink-0 bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 text-xs px-3 py-2 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50">
                <MessageCircle class="w-3.5 h-3.5" />
                <span class="hidden sm:inline">{{ contactingSendingTo === p.phone ? 'Envoi...' : 'WhatsApp' }}</span>
              </button>
            </div>
          </div>
        </template><!-- fin TAB PARTICIPANTS -->

        <!-- === TAB BILLETTERIE === -->
        <template v-if="activeTab === 'billetterie'">
          <div v-if="loadingBilletterie" class="text-center py-16">
            <Loader2 class="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
            <p class="text-gray-400 text-sm">Chargement...</p>
          </div>
          <div v-else-if="!billetterieData.length" class="text-center py-16">
            <Ticket class="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p class="text-gray-400">Aucun événement</p>
          </div>
          <div v-else class="space-y-6">
            <div v-for="item in billetterieData" :key="item.event.id"
              class="bg-surface border border-gray-800 rounded-xl overflow-hidden">
              <!-- En-tête event -->
              <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <div class="flex-1 min-w-0">
                  <p class="font-bold text-white text-sm line-clamp-1">{{ item.event.title }}</p>
                  <p class="text-gray-500 text-xs mt-0.5">{{ formatDate(item.event.date) }}</p>
                </div>
                <button
                  @click="router.push(`/billet/scan/${item.event.id}`)"
                  class="flex-shrink-0 bg-purple-500/20 text-purple-400 text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-purple-500/30 transition ml-2">
                  <ScanLine class="w-3.5 h-3.5" /> Scanner
                </button>
              </div>

              <!-- Stats globales -->
              <div class="grid grid-cols-2 sm:grid-cols-4 sm:divide-x divide-gray-800 border-b border-gray-800">
                <div class="text-center py-3 px-2 border-b border-gray-800 sm:border-b-0">
                  <p class="text-lg font-bold text-white">{{ item.rsvps.length }}</p>
                  <p class="text-[10px] text-gray-500">RSVP</p>
                </div>
                <div class="text-center py-3 px-2 border-b border-gray-800 sm:border-b-0">
                  <p class="text-lg font-bold text-green-400">{{ getTicketStats(item.tickets).valid }}</p>
                  <p class="text-[10px] text-gray-500">Billets valides</p>
                </div>
                <div class="text-center py-3 px-2">
                  <p class="text-lg font-bold text-primary">{{ getTicketStats(item.tickets).used }}</p>
                  <p class="text-[10px] text-gray-500">Scannés</p>
                </div>
                <div class="text-center py-3 px-2">
                  <p class="text-lg font-bold text-yellow-400">{{ (getTicketStats(item.tickets).revenue / 1).toLocaleString() }}</p>
                  <p class="text-[10px] text-gray-500">CFA</p>
                </div>
              </div>

              <!-- Nomenclature billets -->
              <div class="px-4 py-3">
                <div class="flex items-center justify-between mb-3">
                  <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Types de billets</p>
                  <button
                    @click="editingCategories = editingCategories === item.event.id ? null : item.event.id; newCatForm = { name: '', capacity: '', price: '' }"
                    class="text-xs text-primary flex items-center gap-1 hover:text-primary/80 transition">
                    <Plus class="w-3.5 h-3.5" /> Ajouter
                  </button>
                </div>

                <!-- Liste categories -->
                <div v-if="item.categories.length" class="space-y-2 mb-3">
                  <div v-for="cat in item.categories" :key="cat.id"
                    class="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2">
                    <div>
                      <p class="text-sm font-medium text-white">{{ cat.name }}</p>
                      <p class="text-xs text-gray-400">{{ cat.capacity }} places · {{ cat.price > 0 ? `${cat.price.toLocaleString()} CFA` : 'Gratuit' }}</p>
                    </div>
                    <button @click="removeCategory(item, cat.id)" class="text-red-400 hover:text-red-300 transition p-1">
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p v-else class="text-gray-600 text-xs mb-3">Aucun type défini — utilisez le billet unique de l'événement.</p>

                <!-- Formulaire ajout catégorie -->
                <div v-if="editingCategories === item.event.id" class="bg-gray-900 rounded-xl p-3 space-y-2">
                  <input v-model="newCatForm.name" type="text" placeholder="Nom (ex: VIP, Standard...)"
                    class="w-full bg-gray-800 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-primary focus:outline-none" />
                  <div class="grid grid-cols-2 gap-2">
                    <input v-model="newCatForm.capacity" type="number" placeholder="Nb places"
                      class="w-full bg-gray-800 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-primary focus:outline-none" />
                    <input v-model="newCatForm.price" type="number" placeholder="Prix CFA (0=gratuit)"
                      class="w-full bg-gray-800 text-white px-3 py-2 rounded-lg text-sm border border-gray-700 focus:border-primary focus:outline-none" />
                  </div>
                  <div class="flex gap-2">
                    <button @click="addCategory(item)"
                      class="flex-1 bg-primary text-black font-bold py-2 rounded-lg text-sm flex items-center justify-center gap-1">
                      <Check class="w-4 h-4" /> Ajouter
                    </button>
                    <button @click="editingCategories = null" class="bg-gray-700 text-white px-3 py-2 rounded-lg">
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Liste billets récents -->
              <div v-if="item.tickets.length" class="border-t border-gray-800 px-4 py-3">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billets récents</p>
                <div class="space-y-1 max-h-48 overflow-y-auto">
                  <div v-for="t in item.tickets.slice(0, 20)" :key="t.id"
                    class="flex items-center justify-between py-1.5 border-b border-gray-800/50 last:border-0">
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-medium text-white truncate">{{ t.buyer_pseudo || t.buyer_phone }}</p>
                      <p class="text-[10px] text-gray-500">{{ t.buyer_phone }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-mono text-gray-400">{{ t.price > 0 ? `${t.price.toLocaleString()} CFA` : 'Gratuit' }}</span>
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        :class="{
                          'bg-green-500/20 text-green-400': t.status === 'valid' && t.payment_status === 'paid',
                          'bg-primary/20 text-primary': t.status === 'used',
                          'bg-yellow-500/20 text-yellow-400': t.payment_status === 'pending',
                          'bg-red-500/20 text-red-400': t.status === 'cancelled'
                        }">
                        {{ t.status === 'used' ? 'Scanné' : t.payment_status === 'pending' ? 'En attente' : t.status === 'cancelled' ? 'Annulé' : 'Valide' }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template><!-- fin TAB BILLETTERIE -->

        <!-- === TAB NOTIFICATIONS === -->
        <template v-if="activeTab === 'notifs'">
          <div class="flex items-center justify-between mb-4">
            <p class="text-xs text-gray-500">Activité sur vos événements (30 derniers jours)</p>
            <button @click="loadNotifications" :disabled="loadingNotifs" class="text-xs text-primary disabled:opacity-50">
              <Loader2 v-if="loadingNotifs" class="w-3 h-3 animate-spin inline mr-1" />
              Actualiser
            </button>
          </div>
          <div v-if="loadingNotifs && !notifications.length" class="text-center py-16">
            <Loader2 class="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
            <p class="text-gray-400 text-sm">Chargement...</p>
          </div>
          <div v-else-if="!notifications.length" class="text-center py-16">
            <Bell class="w-16 h-16 text-gray-700 mx-auto mb-4" />
            <p class="text-gray-400 text-lg mb-1">Aucune notification</p>
            <p class="text-gray-600 text-sm">L'activité sur vos événements apparaîtra ici</p>
          </div>
          <div v-else class="space-y-2">
            <div v-for="n in notifications" :key="n.id"
              @click="n.eventId && router.push(`/organizer/events/${n.eventId}`)"
              class="bg-surface border border-gray-800 rounded-xl p-3 flex items-start gap-3 cursor-pointer hover:border-gray-700 transition">
              <div class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                :class="{
                  'bg-blue-500/20 text-blue-400': n.type === 'rsvp',
                  'bg-green-500/20 text-green-400': n.type === 'ticket' || n.type === 'approved',
                  'bg-red-500/20 text-red-400': n.type === 'rejected'
                }">
                <Users v-if="n.type === 'rsvp'" class="w-4 h-4" />
                <Ticket v-else-if="n.type === 'ticket'" class="w-4 h-4" />
                <Check v-else-if="n.type === 'approved'" class="w-4 h-4" />
                <X v-else-if="n.type === 'rejected'" class="w-4 h-4" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-white">{{ n.title }}</p>
                <p class="text-xs text-gray-400 truncate">{{ n.body }}</p>
                <p class="text-[10px] text-gray-600 mt-0.5">{{ formatTimeAgo(n.timestamp) }}</p>
              </div>
            </div>
          </div>
        </template><!-- fin TAB NOTIFICATIONS -->

      </main>
    </template>

    <!-- Modal Abonnés -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showFollowersModal"
          class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          @click.self="showFollowersModal = false">
          <div class="bg-surface border border-gray-800 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col">
            <header class="flex items-center justify-between p-4 border-b border-gray-800">
              <div class="flex items-center gap-2">
                <Users class="w-5 h-5 text-blue-400" />
                <h3 class="font-bold text-white">Mes abonnés</h3>
                <span class="text-sm text-gray-400">({{ followersCount }})</span>
              </div>
              <button @click="showFollowersModal = false" class="text-gray-400 hover:text-white">
                <X class="w-5 h-5" />
              </button>
            </header>

            <div class="flex-1 overflow-y-auto p-4">
              <div v-if="loadingFollowers" class="flex justify-center py-8">
                <Loader2 class="w-6 h-6 text-primary animate-spin" />
              </div>
              <div v-else-if="!followersList.length" class="text-center text-gray-500 py-8 text-sm">
                Aucun abonné pour le moment.
              </div>
              <ul v-else class="space-y-2">
                <li v-for="f in followersList" :key="f.id"
                  class="flex items-center gap-3 bg-gray-900/40 rounded-xl p-3">
                  <div class="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center text-sm font-bold text-white shrink-0">
                    <img v-if="f.avatar_url || f.avatar" :src="f.avatar_url || f.avatar" :alt="f.pseudo" class="w-full h-full object-cover" />
                    <span v-else>{{ (f.pseudo || f.name || '?').slice(0,1).toUpperCase() }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-white text-sm truncate">{{ f.pseudo || f.name || 'Utilisateur' }}</p>
                    <p class="text-xs text-gray-500 truncate">{{ f.phone || '' }}</p>
                  </div>
                  <button v-if="f.phone" @click="contactFollower(f)"
                    class="bg-green-500/20 hover:bg-green-500/30 text-green-400 p-2 rounded-lg transition" title="Contacter par WhatsApp">
                    <MessageCircle class="w-4 h-4" />
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
