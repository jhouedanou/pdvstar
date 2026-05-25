<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { createTicket, markTicketPaid, buildQrDataUrl } from '../services/ticketService'
import { initDeposit, waitForDepositFinal, predictProvider, PAWAPAY_PROVIDERS_CI, isPaymentConfigured } from '../services/paymentService'
import { ArrowLeft, Ticket, Loader2, CheckCircle2, XCircle, Download, FileText } from 'lucide-vue-next'
import { downloadQrAsImage, downloadQrAsPdf } from '../utils/qrDownload'

const route = useRoute()
const router = useRouter()
const eventStore = useEventStore()
const userStore = useUserStore()

const eventId = route.params.id
const event = computed(() => eventStore.events.find(e => e.id === eventId))

const phone = ref(userStore.user?.phone || '')
const provider = ref('')
const detectedProvider = ref(null)
const ticket = ref(null)
const qrDataUrl = ref('')
const isProcessing = ref(false)
const step = ref('form')  // form | paying | success | failed
const errorMsg = ref('')
const failureReason = ref('')
const paymentReady = isPaymentConfigured()

onMounted(async () => {
    if (!eventStore.events.length) await eventStore.loadEvents()
})

const downloading = ref(false)
const handleDownloadImage = async () => {
    if (!qrDataUrl.value) return
    downloading.value = true
    const slug = (event.value?.title || 'billet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    await downloadQrAsImage(qrDataUrl.value, `babi-vibes-${slug}`)
    downloading.value = false
}
const handleDownloadPdf = () => {
    if (!qrDataUrl.value || !event.value) return
    downloadQrAsPdf({
        qrDataUrl: qrDataUrl.value,
        eventTitle: event.value.title,
        eventDate: event.value.date ? new Date(event.value.date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '',
        location: event.value.location || event.value.address || '',
        pseudo: ticket.value?.buyer_pseudo || '',
        phone: ticket.value?.buyer_phone || '',
        type: 'BILLET PAYANT'
    })
}

const detect = async () => {
    if (!phone.value) return
    const p = await predictProvider(phone.value)
    detectedProvider.value = p
    if (p) provider.value = p
}

const buy = async () => {
    errorMsg.value = ''
    if (!paymentReady) {
        errorMsg.value = 'Reservation bientot disponible'
        return
    }
    if (!event.value) { errorMsg.value = 'Événement introuvable'; return }
    if (!phone.value) { errorMsg.value = 'Numéro requis'; return }
    if (!provider.value) { errorMsg.value = 'Opérateur requis'; return }

    isProcessing.value = true
    step.value = 'paying'

    try {
        // 1. Créer ticket (pending)
        const t = await createTicket({
            eventId,
            buyerId: userStore.user?.id || null,
            buyerPhone: phone.value,
            buyerPseudo: userStore.user?.pseudo || userStore.user?.name || 'Anonyme',
            price: event.value.ticketPrice || event.value.price || 0,
            commissionRate: event.value.commissionRate || 5,
            paymentMethod: provider.value.toLowerCase()
        })
        if (!t) throw new Error('Création billet impossible')
        ticket.value = t

        // 2. PawaPay deposit
        await initDeposit({
            depositId: t.id,
            amount: t.price,
            phone: phone.value,
            provider: provider.value,
            description: `Billet ${event.value.title}`
        })

        // 3. Polling
        const result = await waitForDepositFinal(t.id, { timeoutMs: 120000, intervalMs: 3000 })

        if (result.status === 'COMPLETED') {
            await markTicketPaid(t.id, result.providerTxId || t.id)
            qrDataUrl.value = await buildQrDataUrl(t.qr_token)
            step.value = 'success'
        } else {
            failureReason.value = result.failureReason || `Paiement ${result.status}`
            step.value = 'failed'
        }
    } catch (e) {
        errorMsg.value = e.message || 'Erreur paiement'
        step.value = 'failed'
        failureReason.value = errorMsg.value
    } finally {
        isProcessing.value = false
    }
}
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <header class="sticky top-0 bg-surface border-b border-gray-800 px-4 py-3 flex items-center gap-3 z-40">
      <button @click="router.back()" class="text-gray-400 hover:text-white">
        <ArrowLeft class="w-5 h-5" />
      </button>
      <h1 class="font-bold flex items-center gap-2"><Ticket class="w-5 h-5 text-primary" /> Billet</h1>
    </header>

    <main class="max-w-md mx-auto p-4">
      <div v-if="!event" class="text-center py-16 text-gray-400">Événement introuvable</div>

      <template v-else>
        <div class="bg-surface rounded-xl overflow-hidden border border-gray-800 mb-6">
          <img v-if="event.image" :src="event.image" class="w-full h-40 object-cover" />
          <div class="p-4">
            <h2 class="font-bold text-lg">{{ event.title }}</h2>
            <p class="text-gray-400 text-sm">{{ event.location }}</p>
            <p class="text-primary font-bold mt-2">{{ event.ticketPrice || event.price || 0 }} CFA</p>
          </div>
        </div>

        <div v-if="!paymentReady" class="bg-surface border border-gray-800 rounded-xl p-5 text-center">
          <Ticket class="w-10 h-10 text-primary mx-auto mb-3" />
          <h3 class="font-bold text-lg mb-2">Reservation bientot disponible</h3>
          <p class="text-gray-400 text-sm">La billetterie est preparee, mais le paiement n'est pas encore configure.</p>
        </div>

        <!-- Form -->
        <div v-else-if="step === 'form'" class="space-y-4">
          <div>
            <label class="text-sm text-gray-400">Numéro Mobile Money (international, ex: 22507XXXXXXXX)</label>
            <input v-model="phone" @blur="detect" type="tel"
              class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 mt-1 focus:border-primary outline-none" />
            <p v-if="detectedProvider" class="text-xs text-green-400 mt-1">Détecté: {{ detectedProvider }}</p>
          </div>

          <div>
            <label class="text-sm text-gray-400">Opérateur</label>
            <div class="grid grid-cols-2 gap-2 mt-1">
              <button v-for="p in PAWAPAY_PROVIDERS_CI" :key="p.code"
                @click="provider = p.code"
                class="border rounded-xl py-3 px-2 text-sm font-medium transition"
                :class="provider === p.code ? 'border-primary bg-primary/10 text-primary' : 'border-gray-700 text-gray-300'">
                {{ p.emoji }} {{ p.name }}
              </button>
            </div>
          </div>

          <div v-if="errorMsg" class="bg-red-900/20 text-red-400 text-sm p-3 rounded-xl">{{ errorMsg }}</div>

          <button @click="buy" :disabled="isProcessing"
            class="w-full bg-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            <Loader2 v-if="isProcessing" class="w-4 h-4 animate-spin" />
            Payer {{ event.ticketPrice || event.price || 0 }} CFA
          </button>
        </div>

        <!-- Paying -->
        <div v-else-if="step === 'paying'" class="text-center py-12">
          <Loader2 class="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p class="text-gray-400">Validez le paiement sur votre téléphone…</p>
          <p class="text-gray-600 text-xs mt-2">Code PIN Mobile Money attendu</p>
        </div>

        <!-- Success -->
        <div v-else-if="step === 'success'" class="text-center py-8">
          <CheckCircle2 class="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 class="text-xl font-bold mb-2">Paiement confirmé !</h3>
          <p class="text-gray-400 text-sm mb-6">Présentez ce QR code à l'entrée</p>
          <div class="bg-white p-4 rounded-2xl inline-block">
            <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR" class="w-64 h-64" />
          </div>
          <p class="text-gray-600 text-xs mt-4 break-all">{{ ticket?.qr_token }}</p>

          <!-- Téléchargement -->
          <div class="grid grid-cols-2 gap-2 mt-6 max-w-xs mx-auto">
            <button @click="handleDownloadImage" :disabled="downloading || !qrDataUrl"
              class="bg-gray-800 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
              <Download class="w-4 h-4" />
              PNG
            </button>
            <button @click="handleDownloadPdf" :disabled="!qrDataUrl"
              class="bg-gray-800 text-white text-sm font-medium py-2.5 rounded-xl hover:bg-gray-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5">
              <FileText class="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        <!-- Failed -->
        <div v-else class="text-center py-12">
          <XCircle class="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p class="text-red-400 font-bold mb-2">Paiement échoué</p>
          <p class="text-gray-500 text-sm mb-6">{{ failureReason }}</p>
          <button @click="step = 'form'" class="bg-gray-800 text-white px-6 py-2 rounded-xl">Réessayer</button>
        </div>
      </template>
    </main>
  </div>
</template>
