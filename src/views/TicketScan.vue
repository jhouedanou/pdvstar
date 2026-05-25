<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore'
import { useEventStore } from '../stores/eventStore'
import { redeemTicket, fetchTicketsForEvent } from '../services/ticketService'
import { checkInRsvpByQr, listRsvpsForEvent } from '../services/rsvpService'
import { ArrowLeft, ScanLine, CheckCircle2, XCircle, RotateCcw, Ticket, Users, Calendar, RefreshCw } from 'lucide-vue-next'
import { QrcodeStream } from 'vue-qrcode-reader'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const eventStore = useEventStore()

const eventId = computed(() => route.params.eventId || null)
const event = computed(() => {
    if (!eventId.value) return null
    return eventStore.events.find(e => String(e.id) === String(eventId.value)) || null
})

const cameraReady = ref(false)
const lastResult = ref(null)
const error = ref('')
const scanning = ref(true)

// Ticket/RSVP counts for this event
const tickets = ref([])
const rsvps = ref([])
const loadingCounts = ref(false)

const validTickets = computed(() => tickets.value.filter(t => t.status === 'valid' && t.payment_status === 'paid').length)
const usedTickets = computed(() => tickets.value.filter(t => t.status === 'used').length)
const checkedInRsvps = computed(() => rsvps.value.filter(r => r.checked_in).length)
const totalRsvps = computed(() => rsvps.value.length)

const loadCounts = async () => {
    if (!eventId.value) return
    loadingCounts.value = true
    try {
        const [t, r] = await Promise.all([
            fetchTicketsForEvent(eventId.value),
            listRsvpsForEvent(eventId.value)
        ])
        tickets.value = t
        rsvps.value = r
    } finally {
        loadingCounts.value = false
    }
}

onMounted(async () => {
    if (!eventStore.events.length) await eventStore.loadEvents()
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(t => t.stop())
        cameraReady.value = true
    } catch (e) {
        error.value = `Caméra inaccessible : ${e.message}`
    }
    if (eventId.value) loadCounts()
})

const onDetect = async (codes) => {
    if (!scanning.value) return
    const token = codes[0]?.rawValue
    if (!token) return
    scanning.value = false
    error.value = ''

    // Essai 1 : QR ticket payant (UUID)
    try {
        const res = await redeemTicket(token, userStore.user?.id || null)
        if (res.ok) {
            lastResult.value = { ...res, type: 'ticket' }
            if (eventId.value) loadCounts()
            return
        }
        if (res.reason?.includes('déjà') || res.reason?.includes('already')) {
            lastResult.value = { ok: false, reason: res.reason }
            return
        }
    } catch {}

    // Essai 2 : QR RSVP gratuit (JSON)
    const rsvpRes = await checkInRsvpByQr(token)

    // Vérifier que le RSVP correspond à cet event si contexte défini
    if (eventId.value && rsvpRes.ok) {
        try {
            const payload = JSON.parse(token)
            if (payload.eid && String(payload.eid) !== String(eventId.value)) {
                lastResult.value = { ok: false, reason: 'QR appartient à un autre événement' }
                return
            }
        } catch {}
    }

    lastResult.value = rsvpRes
    if (eventId.value && rsvpRes.ok) loadCounts()
}

const reset = () => {
    lastResult.value = null
    error.value = ''
    scanning.value = true
}
</script>

<template>
  <div class="min-h-screen bg-black text-white flex flex-col">
    <header class="sticky top-0 bg-surface border-b border-gray-800 px-4 py-3 flex items-center gap-3 z-40">
      <button @click="router.back()" class="text-gray-400"><ArrowLeft class="w-5 h-5" /></button>
      <div class="flex-1 min-w-0">
        <h1 class="font-bold flex items-center gap-2 text-sm">
          <ScanLine class="w-5 h-5 text-primary flex-shrink-0" />
          Contrôle accès
        </h1>
        <p v-if="event" class="text-xs text-gray-400 truncate mt-0.5">{{ event.title }}</p>
      </div>
      <button v-if="eventId" @click="loadCounts" class="text-gray-400 hover:text-white transition" title="Actualiser">
        <RefreshCw class="w-4 h-4" :class="loadingCounts ? 'animate-spin' : ''" />
      </button>
    </header>

    <!-- Compteurs event (si eventId) -->
    <div v-if="eventId && event" class="bg-surface border-b border-gray-800 px-4 py-3">
      <div class="flex gap-4 text-center">
        <div class="flex-1">
          <p class="text-xl font-bold text-primary">{{ validTickets }}</p>
          <p class="text-xs text-gray-400">Billets valides</p>
        </div>
        <div class="flex-1">
          <p class="text-xl font-bold text-green-400">{{ usedTickets }}</p>
          <p class="text-xs text-gray-400">Billets scannés</p>
        </div>
        <div class="flex-1">
          <p class="text-xl font-bold text-blue-400">{{ checkedInRsvps }}/{{ totalRsvps }}</p>
          <p class="text-xs text-gray-400">RSVP entrés</p>
        </div>
      </div>
    </div>

    <main class="flex-1 flex flex-col items-center justify-center p-4">
      <div v-if="error" class="bg-red-900/20 text-red-400 text-sm p-3 rounded-xl mb-4 w-full max-w-sm">{{ error }}</div>

      <!-- Scanner -->
      <div v-if="!lastResult && cameraReady" class="w-full max-w-sm aspect-square bg-gray-900 rounded-2xl overflow-hidden border-2 border-primary/50">
        <QrcodeStream @detect="onDetect" class="w-full h-full" />
      </div>

      <!-- Attente caméra -->
      <div v-else-if="!lastResult && !cameraReady && !error" class="text-gray-500 text-sm">Chargement caméra...</div>

      <!-- Succès -->
      <div v-else-if="lastResult?.ok" class="text-center w-full max-w-sm">
        <CheckCircle2 class="w-24 h-24 text-green-500 mx-auto mb-4" />
        <h2 class="text-2xl font-bold mb-1">Accès validé</h2>
        <div class="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-full mb-3">
          <component :is="lastResult.type === 'rsvp' ? Users : Ticket" class="w-3 h-3" />
          {{ lastResult.type === 'rsvp' ? 'RSVP gratuit' : 'Billet payant' }}
        </div>
        <p class="text-gray-300 font-medium">{{ lastResult.ticket?.buyer_pseudo || lastResult.pseudo }}</p>
        <p class="text-gray-400 text-sm">{{ lastResult.ticket?.buyer_phone || lastResult.phone }}</p>
        <button @click="reset" class="mt-6 bg-primary text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2 mx-auto">
          <RotateCcw class="w-4 h-4" /> Scanner suivant
        </button>
      </div>

      <!-- Refus -->
      <div v-else-if="lastResult && !lastResult.ok" class="text-center w-full max-w-sm">
        <XCircle class="w-24 h-24 text-red-500 mx-auto mb-4" />
        <h2 class="text-2xl font-bold mb-2">Refusé</h2>
        <p class="text-red-400 text-sm bg-red-900/20 rounded-xl px-4 py-2">{{ lastResult.reason }}</p>
        <button @click="reset" class="mt-6 bg-gray-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 mx-auto">
          <RotateCcw class="w-4 h-4" /> Réessayer
        </button>
      </div>

      <p v-if="cameraReady && !lastResult" class="text-gray-500 text-sm mt-4">Centrez le QR code dans le cadre</p>
    </main>
  </div>
</template>
