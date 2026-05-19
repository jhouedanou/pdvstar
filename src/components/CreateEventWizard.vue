<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGeolocation } from '@vueuse/core'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { processImage, processAndUpload } from '../utils/imageUpload'
import { useDictation } from '../composables/useDictation'
import { ArrowLeft, ArrowRight, Calendar, Camera, Check, FileText, MapPin, Ticket, Type, Mic, MicOff, Music } from 'lucide-vue-next'

const router = useRouter()
const store = useEventStore()
const userStore = useUserStore()
const { coords, resume } = useGeolocation()

// Dictée vocale pour la description
const { supported: dictSupported, isListening: isDictating, transcript: dictTranscript, start: startDictation, stop: stopDictation, reset: resetDictation } = useDictation('fr-FR')

// Appliquer la transcription dans la description
watch(dictTranscript, (t) => {
    if (t) form.value.description = t
})

const step = ref(1)
const isSubmitting = ref(false)
const imageError = ref('')
const tagsInput = ref('')
const gpsLoading = ref(false)
const gpsError = ref('')

// Date et heure séparées
const todayStr = new Date().toISOString().slice(0, 10)
const eventDateStr = ref(new Date(Date.now() + 86400000).toISOString().slice(0, 10)) // demain par défaut
const eventTimeStr = ref('20:00')

const steps = [
    { title: 'Media', icon: Camera },
    { title: 'Titre', icon: Type },
    { title: 'Lieu', icon: Calendar },
    { title: 'Details', icon: FileText },
    { title: 'Validation', icon: Check }
]

const form = ref({
    title: '',
    promoText: '',
    description: '',
    category: '',
    date: `${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}T20:00`,
    endDate: '',
    image: '',
    preview: '',
    mediaUrl: '',
    mediaType: 'image',
    location: '',
    address: '',
    city: 'Abidjan',
    district: '',
    coords: null,
    organizerPhone: userStore.user?.phone || '',
    musicTitle: '',
    backgroundMusic: '',
    ticketingEnabled: false,
    ticketPrice: 0,
    ticketCapacity: null
})

// Sync date+heure dans form.date
watch([eventDateStr, eventTimeStr], ([d, t]) => {
    if (d && t) form.value.date = `${d}T${t}`
}, { immediate: true })

const tagList = computed(() => {
    return tagsInput.value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
})

const organizerName = computed(() => {
    return userStore.user?.organizerName || userStore.user?.spaceName || userStore.user?.name || userStore.user?.pseudo || 'Organisateur'
})

const canContinue = computed(() => {
    if (step.value === 1) return !!(form.value.preview || form.value.mediaUrl)
    if (step.value === 2) return !!form.value.title.trim()
    if (step.value === 3) return !!form.value.date && !!form.value.location.trim()
    if (step.value === 4) return !!form.value.description.trim()
    return true
})

const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    imageError.value = ''
    // Preview rapide en base64 d'abord
    const compressed = await processImage(file)
    if (!compressed.success) {
        imageError.value = compressed.error
        return
    }
    form.value.preview = compressed.data
    // Upload en bucket en parallèle (fallback base64 si bucket KO)
    const uploaded = await processAndUpload(file, 'events')
    if (uploaded.success) {
        form.value.image = uploaded.data
        form.value.mediaUrl = uploaded.data
        form.value.mediaType = 'image'
    } else {
        form.value.image = compressed.data
        form.value.mediaUrl = compressed.data
        form.value.mediaType = 'image'
        imageError.value = uploaded.error || 'Upload bucket échoué, image stockée en base64'
    }
}

const useCurrentPosition = async () => {
    gpsLoading.value = true
    gpsError.value = ''
    try {
        await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    form.value.coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                    resolve()
                },
                (err) => reject(err),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            )
        })
    } catch (e) {
        gpsError.value = e.code === 1
            ? 'Géolocalisation refusée. Activez-la dans les paramètres du navigateur.'
            : 'Impossible de récupérer la position. Réessayez.'
    } finally {
        gpsLoading.value = false
    }
}

const nextStep = () => {
    if (step.value < steps.length && canContinue.value) step.value++
}

const prevStep = () => {
    if (step.value > 1) step.value--
}

const publishEvent = async () => {
    if (isSubmitting.value) return
    isSubmitting.value = true

    const lat = form.value.coords?.lat ?? (coords.value.latitude !== Infinity ? coords.value.latitude : 5.30966)
    const lng = form.value.coords?.lng ?? (coords.value.longitude !== Infinity ? coords.value.longitude : -3.97449)
    const status = userStore.isOrganizer ? 'pending' : 'approved'

    await store.addEvent({
        title: form.value.title || 'Evenement sans titre',
        promoText: form.value.promoText || '',
        description: form.value.description || 'Pas de description',
        category: form.value.category || '',
        date: form.value.date,
        eventDate: form.value.date,
        endDate: form.value.endDate || null,
        image: form.value.preview || form.value.mediaUrl,
        mediaUrl: form.value.mediaUrl || form.value.preview,
        mediaType: form.value.mediaType,
        location: form.value.location,
        locationName: form.value.location,
        address: form.value.address,
        city: form.value.city,
        ville: form.value.city,
        district: form.value.district,
        quartier: form.value.district,
        coords: { lat, lng },
        organizer: organizerName.value,
        organizerName: organizerName.value,
        organizerPhone: form.value.organizerPhone || userStore.user?.phone || '',
        musicTitle: form.value.musicTitle || '',
        backgroundMusic: form.value.backgroundMusic || '',
        organizerId: userStore.user?.id || null,
        createdBy: userStore.user?.id || null,
        status,
        tags: tagList.value,
        features: tagList.value,
        ticketingEnabled: form.value.ticketingEnabled,
        isTicketingEnabled: form.value.ticketingEnabled,
        ticketPrice: form.value.ticketingEnabled ? Number(form.value.ticketPrice) || 0 : 0,
        ticketCapacity: form.value.ticketCapacity ? Number(form.value.ticketCapacity) : null,
        distance: '0 km'
    })

    isSubmitting.value = false
    router.push('/organizer')
}

onMounted(() => {
    resume()
})
</script>

<template>
  <div class="min-h-screen bg-black text-white flex flex-col">
    <header class="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-gray-800 px-4 py-3">
      <div class="max-w-lg mx-auto flex items-center justify-between">
        <button @click="router.back()" class="text-gray-400 hover:text-white p-2 -ml-2">
          <ArrowLeft class="w-5 h-5" />
        </button>
        <div class="text-center">
          <h1 class="font-bold text-primary">Nouvel evenement</h1>
          <p class="text-xs text-gray-500">Soumission organisateur</p>
        </div>
        <div class="w-9"></div>
      </div>
      <div class="max-w-lg mx-auto flex gap-1 mt-3">
        <div
          v-for="i in steps.length"
          :key="i"
          class="h-1 flex-1 rounded-full transition"
          :class="i <= step ? 'bg-primary' : 'bg-gray-800'"
        ></div>
      </div>
    </header>

    <main class="flex-1 w-full max-w-lg mx-auto p-5 flex flex-col">
      <div class="flex items-center gap-2 mb-5 text-sm text-gray-400">
        <component :is="steps[step - 1].icon" class="w-4 h-4 text-primary" />
        <span>Etape {{ step }} sur {{ steps.length }} - {{ steps[step - 1].title }}</span>
      </div>

      <section v-if="step === 1" class="space-y-5">
        <div>
          <h2 class="text-2xl font-bold mb-2">Media vertical</h2>
          <p class="text-gray-400 text-sm">Ajoute une affiche ou une URL image/video.</p>
        </div>
        <label class="block w-full aspect-[4/5] bg-gray-900 border-2 border-dashed border-gray-700 rounded-2xl cursor-pointer hover:border-primary transition overflow-hidden">
          <img v-if="form.preview" :src="form.preview" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex flex-col items-center justify-center text-gray-500">
            <Camera class="w-14 h-14 mb-3" />
            <span class="font-medium">Ajouter une image</span>
          </div>
          <input type="file" accept="image/*" @change="handleFileChange" class="hidden" />
        </label>
        <p v-if="imageError" class="text-red-400 text-sm">{{ imageError }}</p>
        <input
          v-model="form.mediaUrl"
          type="url"
          placeholder="Ou coller une URL image/video"
          class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary"
        />
      </section>

      <section v-else-if="step === 2" class="space-y-5">
        <div>
          <h2 class="text-2xl font-bold mb-2">Titre et accroche</h2>
          <p class="text-gray-400 text-sm">Donne une promesse claire et courte.</p>
        </div>
        <input v-model="form.title" type="text" placeholder="Titre de l'evenement" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        <input v-model="form.promoText" type="text" placeholder="Texte promo court" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
      </section>

      <section v-else-if="step === 3" class="space-y-4">
        <div>
          <h2 class="text-2xl font-bold mb-2">Date et lieu</h2>
          <p class="text-gray-400 text-sm">Ces données alimentent le feed géolocalise.</p>
        </div>
        <!-- Date picker -->
        <div class="space-y-1">
          <label class="text-xs text-gray-400 font-medium">Date de l'événement</label>
          <input v-model="eventDateStr" type="date" :min="todayStr"
            class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary text-white [color-scheme:dark]" />
        </div>
        <!-- Heure de début -->
        <div class="space-y-1">
          <label class="text-xs text-gray-400 font-medium">Heure de début</label>
          <input v-model="eventTimeStr" type="time"
            class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary text-white [color-scheme:dark]" />
        </div>
        <!-- Heure de fin (optionnel) -->
        <div class="space-y-1">
          <label class="text-xs text-gray-400 font-medium">Heure de fin <span class="text-gray-600">(optionnel)</span></label>
          <input v-model="form.endDate" type="datetime-local" :min="form.date"
            class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary text-white [color-scheme:dark]" />
        </div>
        <input v-model="form.location" type="text" placeholder="Nom du lieu ou point de vente" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        <input v-model="form.address" type="text" placeholder="Adresse" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        <div class="grid grid-cols-2 gap-3">
          <input v-model="form.city" type="text" placeholder="Ville" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          <input v-model="form.district" type="text" placeholder="Quartier" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        </div>
        <!-- Bouton GPS -->
        <button @click="useCurrentPosition" :disabled="gpsLoading"
          class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 flex items-center justify-center gap-2 text-gray-300 hover:border-primary transition disabled:opacity-60">
          <MapPin class="w-4 h-4" :class="gpsLoading ? 'animate-pulse text-primary' : ''" />
          <span v-if="gpsLoading">Localisation en cours...</span>
          <span v-else-if="form.coords">GPS : {{ form.coords.lat.toFixed(4) }}, {{ form.coords.lng.toFixed(4) }}</span>
          <span v-else>Utiliser ma position GPS</span>
        </button>
        <p v-if="gpsError" class="text-red-400 text-xs px-1">{{ gpsError }}</p>
        <input v-model="form.organizerPhone" type="tel" placeholder="Telephone WhatsApp organisateur" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
      </section>

      <section v-else-if="step === 4" class="space-y-4">
        <div>
          <h2 class="text-2xl font-bold mb-2">Description et tags</h2>
          <p class="text-gray-400 text-sm">Les tags servent aux filtres et au ciblage publicitaire.</p>
        </div>
        <!-- Catégorie -->
        <div class="space-y-1">
          <label class="text-xs text-gray-400 font-medium">Catégorie</label>
          <select v-model="form.category" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary text-white">
            <option value="">Choisir une catégorie...</option>
            <option value="musique">🎵 Musique</option>
            <option value="dj">🎧 DJ / Club</option>
            <option value="brunch">🥂 Brunch</option>
            <option value="sport">⚽ Sport</option>
            <option value="art">🎨 Art &amp; Culture</option>
            <option value="comedie">😂 Comédie</option>
            <option value="afterwork">🍹 Afterwork</option>
            <option value="festival">🂪 Festival</option>
          </select>
        </div>
        <textarea v-model="form.description" rows="5" placeholder="Ambiance, programme, infos pratiques..." class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary resize-none"></textarea>
        <input v-model="tagsInput" type="text" placeholder="Tags separes par des virgules" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        <label class="w-full flex items-center justify-between bg-gray-900 border border-gray-700 rounded-xl p-4 cursor-pointer">
          <span class="font-medium">Preparer la reservation</span>
          <input type="checkbox" v-model="form.ticketingEnabled" class="w-5 h-5 accent-primary" />
        </label>
        <div v-if="form.ticketingEnabled" class="grid grid-cols-2 gap-3">
          <input v-model.number="form.ticketPrice" type="number" min="0" step="500" placeholder="Prix CFA" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          <input v-model.number="form.ticketCapacity" type="number" min="1" placeholder="Capacite" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        </div>
      </section>

      <section v-else class="space-y-5">
        <div>
          <h2 class="text-2xl font-bold mb-2">Recapitulatif</h2>
          <p class="text-gray-400 text-sm">L'evenement sera envoye en validation admin.</p>
        </div>
        <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <img v-if="form.preview || form.mediaUrl" :src="form.preview || form.mediaUrl" class="w-full h-48 object-cover" />
          <div class="p-4 space-y-2">
            <h3 class="text-xl font-bold">{{ form.title }}</h3>
            <p class="text-primary text-sm">{{ new Date(form.date).toLocaleString('fr-FR') }}</p>
            <p class="text-gray-300 text-sm">{{ form.location }} - {{ form.district || form.city }}</p>
            <p class="text-gray-400 text-sm line-clamp-3">{{ form.description }}</p>
            <div v-if="tagList.length" class="flex flex-wrap gap-2 pt-2">
              <span v-for="tag in tagList" :key="tag" class="bg-white/10 text-white text-xs px-2 py-1 rounded-full">{{ tag }}</span>
            </div>
            <div v-if="form.ticketingEnabled" class="inline-flex items-center gap-1 bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">
              <Ticket class="w-3 h-3" /> {{ form.ticketPrice || 0 }} CFA
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="sticky bottom-0 bg-black/95 backdrop-blur border-t border-gray-800 p-4">
      <div class="max-w-lg mx-auto flex justify-between items-center gap-3">
        <button v-if="step > 1" @click="prevStep" class="px-4 py-3 text-gray-400 hover:text-white transition">
          Retour
        </button>
        <div v-else></div>

        <button
          v-if="step < steps.length"
          @click="nextStep"
          :disabled="!canContinue"
          class="bg-primary text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Suivant <ArrowRight class="w-5 h-5" />
        </button>
        <button
          v-else
          @click="publishEvent"
          :disabled="isSubmitting"
          class="bg-green-500 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 disabled:opacity-50"
        >
          <Check class="w-5 h-5" />
          {{ isSubmitting ? 'Envoi...' : 'Soumettre a validation' }}
        </button>
      </div>
    </footer>
  </div>
</template>
