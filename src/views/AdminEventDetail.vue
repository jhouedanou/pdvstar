<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Calendar, CheckCircle2, Eye, MapPin, MousePointerClick, ShieldX, Star, Users } from 'lucide-vue-next'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { approveEvent as approveModeration, rejectEvent as rejectModeration } from '../services/moderationService'
import { listRsvpsForEvent } from '../services/rsvpService'
import { sendWhatsAppMessage } from '../services/greenApiService'

const route = useRoute()
const router = useRouter()
const eventStore = useEventStore()
const userStore = useUserStore()
const attendees = ref([])
const rejectionReason = ref('')
const isBusy = ref(false)

const event = computed(() => eventStore.events.find((item) => String(item.id) === String(route.params.id)))

const load = async () => {
    if (!eventStore.events.length) await eventStore.loadEvents()
    if (event.value) attendees.value = await listRsvpsForEvent(event.value.id)
}

const notifyOrganizer = (ev, approved, reason = '') => {
    const phone = ev.organizerPhone || ev.organizer_phone
    if (!phone) return
    const title = ev.title || 'Votre événement'
    const date = ev.date ? new Date(ev.date).toLocaleString('fr-FR') : ''
    const msg = approved
        ? `Babi Vibes — Événement approuvé !\n\n"${title}" (${date}) est maintenant visible sur l'application.\n\nMerci et bonne chance !`
        : `Babi Vibes — Événement refusé\n\n"${title}" n'a pas été approuvé.\n\nRaison : ${reason || 'Non conforme aux critères'}\n\nCorrigez et soumettez à nouveau.`
    sendWhatsAppMessage(phone, msg).catch(() => {})
}

const approve = async () => {
    if (!event.value || isBusy.value) return
    isBusy.value = true
    await eventStore.updateEvent(event.value.id, {
        status: 'approved',
        rejectionReason: '',
        approvedBy: userStore.user?.id || null,
        approvedAt: new Date().toISOString()
    })
    await approveModeration(event.value.id, userStore.user?.id || null).catch(() => {})
    notifyOrganizer(event.value, true)
    isBusy.value = false
}

const reject = async () => {
    if (!event.value || !rejectionReason.value.trim() || isBusy.value) return
    isBusy.value = true
    const reason = rejectionReason.value.trim()
    await eventStore.updateEvent(event.value.id, {
        status: 'rejected',
        rejectionReason: reason
    })
    await rejectModeration(event.value.id, reason, userStore.user?.id || null).catch(() => {})
    notifyOrganizer(event.value, false, reason)
    isBusy.value = false
}

const toggleFeatured = async () => {
    if (!event.value) return
    await eventStore.updateEvent(event.value.id, { isFeatured: !event.value.isFeatured })
}

const archive = async () => {
    if (!event.value) return
    await eventStore.updateEvent(event.value.id, { status: 'archived' })
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <header class="sticky top-0 z-30 bg-surface border-b border-gray-800 px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <button @click="router.push('/admin/events')" class="text-gray-400 hover:text-white flex items-center gap-2">
          <ArrowLeft class="w-4 h-4" />
          Moderation
        </button>
        <h1 class="font-bold text-primary">Detail admin</h1>
        <div class="w-24"></div>
      </div>
    </header>

    <main class="max-w-5xl mx-auto p-4">
      <div v-if="!event" class="text-center py-20 text-gray-400">Evenement introuvable</div>

      <template v-else>
        <section class="grid lg:grid-cols-[360px_1fr] gap-5 mb-6">
          <img v-if="event.image" :src="event.image" :alt="event.title" class="w-full h-80 object-cover rounded-2xl border border-gray-800" />
          <div class="bg-surface border border-gray-800 rounded-2xl p-5">
            <div class="flex items-center gap-2 mb-3">
              <span class="bg-white/10 text-white text-xs font-bold px-3 py-1 rounded-full">{{ event.status || 'approved' }}</span>
              <span v-if="event.isFeatured" class="bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full">Mis en avant</span>
            </div>
            <h2 class="text-2xl font-bold mb-3">{{ event.title }}</h2>
            <div class="space-y-2 text-sm text-gray-300">
              <p class="flex items-center gap-2"><Calendar class="w-4 h-4 text-primary" /> {{ new Date(event.date).toLocaleString('fr-FR') }}</p>
              <p class="flex items-center gap-2"><MapPin class="w-4 h-4 text-primary" /> {{ event.location }}</p>
              <p>Organisateur : {{ event.organizer || event.organizerName }}</p>
              <p>Telephone : {{ event.organizerPhone || 'Non renseigne' }}</p>
            </div>
            <p class="text-gray-400 text-sm mt-4">{{ event.description }}</p>
          </div>
        </section>

        <section class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div class="bg-surface border border-gray-800 rounded-xl p-4">
            <Eye class="w-4 h-4 text-primary mb-2" />
            <p class="text-2xl font-bold">{{ event.viewCount || 0 }}</p>
            <p class="text-xs text-gray-500">Vues</p>
          </div>
          <div class="bg-surface border border-gray-800 rounded-xl p-4">
            <MousePointerClick class="w-4 h-4 text-primary mb-2" />
            <p class="text-2xl font-bold">{{ event.clickCount || 0 }}</p>
            <p class="text-xs text-gray-500">Clics</p>
          </div>
          <div class="bg-surface border border-gray-800 rounded-xl p-4">
            <Users class="w-4 h-4 text-primary mb-2" />
            <p class="text-2xl font-bold">{{ attendees.length }}</p>
            <p class="text-xs text-gray-500">Contacts</p>
          </div>
          <div class="bg-surface border border-gray-800 rounded-xl p-4">
            <Star class="w-4 h-4 text-primary mb-2" />
            <p class="text-2xl font-bold">{{ event.isFeatured ? 'Oui' : 'Non' }}</p>
            <p class="text-xs text-gray-500">Avant</p>
          </div>
        </section>

        <section class="bg-surface border border-gray-800 rounded-2xl p-5 mb-6">
          <h3 class="font-bold mb-4">Actions de moderation</h3>
          <div class="grid sm:grid-cols-3 gap-3">
            <button @click="approve" :disabled="isBusy" class="bg-green-500/20 text-green-300 border border-green-500/30 rounded-xl py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50">
              <CheckCircle2 class="w-4 h-4" />
              Approuver
            </button>
            <button @click="toggleFeatured" class="bg-primary/20 text-primary border border-primary/30 rounded-xl py-3 font-bold flex items-center justify-center gap-2">
              <Star class="w-4 h-4" />
              {{ event.isFeatured ? 'Retirer avant' : 'Mettre en avant' }}
            </button>
            <button @click="archive" class="bg-gray-800 text-gray-300 border border-gray-700 rounded-xl py-3 font-bold">
              Archiver
            </button>
          </div>
          <div class="mt-4">
            <label class="text-sm text-gray-400">Motif de rejet</label>
            <textarea v-model="rejectionReason" rows="3" class="w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-red-500 resize-none" placeholder="Motif obligatoire pour rejeter"></textarea>
            <button @click="reject" :disabled="isBusy || !rejectionReason.trim()" class="mt-3 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl px-5 py-3 font-bold flex items-center gap-2 disabled:opacity-50">
              <ShieldX class="w-4 h-4" />
              Rejeter
            </button>
          </div>
        </section>

        <section class="bg-surface border border-gray-800 rounded-2xl overflow-hidden">
          <div class="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 class="font-bold">Contacts collectes</h3>
            <span class="text-sm text-gray-400">{{ attendees.length }}</span>
          </div>
          <div v-if="attendees.length === 0" class="p-8 text-center text-gray-500">Aucun contact</div>
          <div v-else class="divide-y divide-gray-800">
            <div v-for="attendee in attendees" :key="attendee.id" class="p-4 flex items-center justify-between gap-3">
              <div>
                <p class="font-semibold">{{ attendee.pseudo }}</p>
                <p class="text-sm text-gray-400">{{ attendee.city || attendee.district || 'Localisation non renseignee' }}</p>
              </div>
              <span class="text-primary text-sm font-bold">{{ attendee.phone }}</span>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
