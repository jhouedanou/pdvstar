<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Calendar, Eye, MapPin, MessageSquare, MousePointerClick, Phone, Users } from 'lucide-vue-next'
import { useEventStore } from '../stores/eventStore'
import { listRsvpsForEvent } from '../services/rsvpService'
import { fetchEventStats } from '../services/statsService'

const route = useRoute()
const router = useRouter()
const eventStore = useEventStore()
const attendees = ref([])
const stats = ref(null)

const event = computed(() => eventStore.events.find((item) => String(item.id) === String(route.params.id)))

const load = async () => {
    if (!eventStore.events.length) await eventStore.loadEvents()
    if (event.value) {
        attendees.value = await listRsvpsForEvent(event.value.id)
        stats.value = await fetchEventStats(event.value.id)
    }
}

const statusLabel = computed(() => {
    const status = event.value?.status || 'approved'
    return {
        draft: 'Brouillon',
        pending: 'En attente',
        approved: 'Approuve',
        rejected: 'Refuse',
        archived: 'Archive'
    }[status] || status
})

onMounted(load)
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <header class="sticky top-0 z-30 bg-surface border-b border-gray-800 px-4 py-3">
      <div class="max-w-4xl mx-auto flex items-center justify-between">
        <button @click="router.push('/organizer')" class="text-gray-400 hover:text-white flex items-center gap-2">
          <ArrowLeft class="w-4 h-4" />
          Organisateur
        </button>
        <h1 class="font-bold text-primary">Detail evenement</h1>
        <div class="w-24"></div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto p-4">
      <div v-if="!event" class="text-center py-20 text-gray-400">Evenement introuvable</div>

      <template v-else>
        <section class="grid lg:grid-cols-[320px_1fr] gap-5 mb-6">
          <img v-if="event.image" :src="event.image" :alt="event.title" class="w-full h-72 object-cover rounded-2xl border border-gray-800" />
          <div class="bg-surface border border-gray-800 rounded-2xl p-5">
            <span class="inline-flex mb-3 bg-primary/15 text-primary text-xs font-bold px-3 py-1 rounded-full">{{ statusLabel }}</span>
            <h2 class="text-2xl font-bold mb-3">{{ event.title }}</h2>
            <div class="space-y-2 text-sm text-gray-300">
              <p class="flex items-center gap-2"><Calendar class="w-4 h-4 text-primary" /> {{ new Date(event.date).toLocaleString('fr-FR') }}</p>
              <p class="flex items-center gap-2"><MapPin class="w-4 h-4 text-primary" /> {{ event.location }}</p>
              <p class="flex items-center gap-2"><Phone class="w-4 h-4 text-primary" /> {{ event.organizerPhone || 'Telephone organisateur non renseigne' }}</p>
            </div>
            <p class="text-gray-400 text-sm mt-4">{{ event.description }}</p>
            <div v-if="event.status === 'rejected' && event.rejectionReason" class="mt-4 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl p-3 text-sm">
              Motif de rejet : {{ event.rejectionReason }}
            </div>
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
            <p class="text-xs text-gray-500">J'y vais</p>
          </div>
          <div class="bg-surface border border-gray-800 rounded-xl p-4">
            <MessageSquare class="w-4 h-4 text-primary mb-2" />
            <p class="text-2xl font-bold">{{ attendees.filter((item) => item.whatsapp_sent || item.notified_organizer).length }}</p>
            <p class="text-xs text-gray-500">WhatsApp</p>
          </div>
        </section>

        <section class="bg-surface border border-gray-800 rounded-2xl overflow-hidden">
          <div class="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 class="font-bold">Contacts interesses</h3>
            <span class="text-sm text-gray-400">{{ attendees.length }} contact(s)</span>
          </div>
          <div v-if="attendees.length === 0" class="p-8 text-center text-gray-500">Aucun contact pour le moment</div>
          <div v-else class="divide-y divide-gray-800">
            <div v-for="attendee in attendees" :key="attendee.id" class="p-4 flex items-center justify-between gap-3">
              <div>
                <p class="font-semibold">{{ attendee.pseudo }}</p>
                <p class="text-sm text-gray-400">{{ attendee.city || attendee.district || 'Localisation non renseignee' }}</p>
              </div>
              <a :href="`tel:${attendee.phone}`" class="text-primary text-sm font-bold">{{ attendee.phone }}</a>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
