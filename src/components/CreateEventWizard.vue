<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGeolocation } from '@vueuse/core'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { processImage, processAndUpload } from '../utils/imageUpload'
import { useDictation } from '../composables/useDictation'
import { ArrowLeft, ArrowRight, Calendar, Camera, Check, FileText, Loader2, MapPin, Mic, MicOff, Music, Plus, Tag, Ticket, Type, X } from 'lucide-vue-next'
import { sendWhatsAppMessage } from '../services/greenApiService'
import { EVENT_CATEGORIES } from '../constants/categories'

const router = useRouter()
const store = useEventStore()
const userStore = useUserStore()
const { coords, resume } = useGeolocation()

// Dictée vocale multi-champs
const { supported: dictSupported, isListening: isDictating, transcript: dictTranscript, interim: dictInterim, error: dictRawError, start: startSpeechDictation, stop: stopSpeechDictation, reset: resetDictation } = useDictation('fr-FR')

const step = ref(1)
const isSubmitting = ref(false)
const imageError = ref('')
const tagsInput = ref('')
const customTagInput = ref('')
const gpsLoading = ref(false)
const gpsError = ref('')
const dictationField = ref('')
const dictationBaseText = ref('')
const dictationError = ref('')
const isFetchingTitle = ref(false)
let fetchTitleTimeout = null

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
    videoUrl: '',
    location: '',
    address: '',
    city: 'Abidjan',
    district: '',
    coords: null,
    organizer: '',
    organizerPhone: userStore.user?.phone || '',
    features: [],
    isPremium: false,
    price: 0,
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

const selectedTags = computed(() => {
    return [...new Set([...form.value.features, ...tagList.value])]
})

const organizerName = computed(() => {
    return userStore.user?.organizerName || userStore.user?.spaceName || userStore.user?.name || userStore.user?.pseudo || 'Organisateur'
})

const predefinedTags = [
    'VIP Access', 'Free Drink', 'Photo Booth', 'Live DJ',
    'Open Bar', 'Dress Code', 'Parking', 'Guest List',
    'After Party', 'Buffet', 'Piscine', 'Jeux'
]

const dictationFieldLabels = {
    title: 'Titre',
    promoText: 'Promotion',
    location: 'Lieu',
    organizer: 'Organisateur',
    description: 'Description',
    musicTitle: 'Titre musique',
    customTag: 'Tag'
}

const extractYouTubeId = (url) => {
    if (!url) return null
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ]
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

const isBackgroundMusicValid = computed(() => {
    return !form.value.backgroundMusic || !!extractYouTubeId(form.value.backgroundMusic)
})

const isMediaReady = computed(() => {
    return !!(form.value.preview || form.value.mediaUrl)
})

const canContinue = computed(() => {
    if (step.value === 1) return isMediaReady.value
    if (step.value === 2) return !!form.value.title.trim()
    if (step.value === 3) return !!form.value.date && !!form.value.location.trim()
    if (step.value === 4) return !!form.value.description.trim() && isBackgroundMusicValid.value
    return true
})

watch(dictTranscript, (t) => {
    if (!dictationField.value || !t) return
    if (dictationField.value === 'customTag') {
        customTagInput.value = t
        return
    }
    form.value[dictationField.value] = dictationBaseText.value ? `${dictationBaseText.value} ${t}` : t
})

watch(dictRawError, (error) => {
    if (!error) return
    dictationError.value = error === 'not-allowed'
        ? 'Acces micro refuse. Autorisez le micro puis reessayez.'
        : `Dictee indisponible : ${error}`
    setTimeout(() => { dictationError.value = '' }, 4000)
})

watch(isDictating, (listening) => {
    if (!listening) dictationField.value = ''
})

const toggleDictation = (field) => {
    dictationError.value = ''
    if (!dictSupported) {
        dictationError.value = 'Dictee vocale non supportee. Utilisez Chrome ou Edge.'
        setTimeout(() => { dictationError.value = '' }, 4000)
        return
    }
    if (isDictating.value && dictationField.value === field) {
        stopSpeechDictation()
        return
    }
    stopSpeechDictation()
    resetDictation()
    dictationField.value = field
    dictationBaseText.value = field === 'customTag' ? '' : (form.value[field] || '')
    startSpeechDictation()
}

const stopCurrentDictation = () => {
    stopSpeechDictation()
    dictationField.value = ''
}

const toggleTag = (tag) => {
    const idx = form.value.features.indexOf(tag)
    if (idx >= 0) form.value.features.splice(idx, 1)
    else form.value.features.push(tag)
}

const addCustomTag = () => {
    const tag = customTagInput.value.trim()
    if (tag && !form.value.features.includes(tag)) {
        form.value.features.push(tag)
    }
    customTagInput.value = ''
    resetDictation()
}

const removeTag = (index) => {
    form.value.features.splice(index, 1)
}

const fetchYouTubeTitle = async (url) => {
    const videoId = extractYouTubeId(url)
    if (!videoId || form.value.musicTitle.trim()) return
    isFetchingTitle.value = true
    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
        if (response.ok) {
            const data = await response.json()
            if (data.title && !form.value.musicTitle.trim()) form.value.musicTitle = data.title
        }
    } catch (err) {
        console.warn('Titre YouTube indisponible:', err)
    } finally {
        isFetchingTitle.value = false
    }
}

watch(() => form.value.backgroundMusic, (newUrl) => {
    if (fetchTitleTimeout) clearTimeout(fetchTitleTimeout)
    if (newUrl && extractYouTubeId(newUrl)) {
        fetchTitleTimeout = setTimeout(() => fetchYouTubeTitle(newUrl), 600)
    }
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
    } else {
        form.value.image = compressed.data
        form.value.mediaUrl = compressed.data
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
    const eventOrganizer = form.value.organizer || organizerName.value
    const coverImage = form.value.preview || form.value.mediaUrl || form.value.image || ''

    await store.addEvent({
        title: form.value.title || 'Evenement sans titre',
        promoText: form.value.promoText || '',
        description: form.value.description || 'Pas de description',
        category: form.value.category || '',
        date: form.value.date,
        eventDate: form.value.date,
        endDate: form.value.endDate || null,
        image: coverImage,
        mediaUrl: coverImage,
        mediaType: 'image',
        videoUrl: '',
        location: form.value.location,
        locationName: form.value.location,
        address: form.value.address,
        city: form.value.city,
        ville: form.value.city,
        district: form.value.district,
        quartier: form.value.district,
        coords: { lat, lng },
        organizer: eventOrganizer,
        organizerName: eventOrganizer,
        organizerPhone: form.value.organizerPhone || userStore.user?.phone || '',
        musicTitle: form.value.musicTitle || '',
        backgroundMusic: form.value.backgroundMusic || '',
        musicUrl: form.value.backgroundMusic || '',
        isPremium: form.value.isPremium,
        price: form.value.isPremium ? Number(form.value.price) || 0 : 0,
        organizerId: userStore.user?.id || null,
        createdBy: userStore.user?.id || null,
        status,
        tags: selectedTags.value,
        features: selectedTags.value,
        ticketingEnabled: form.value.ticketingEnabled,
        isTicketingEnabled: form.value.ticketingEnabled,
        ticketPrice: form.value.ticketingEnabled ? Number(form.value.ticketPrice) || 0 : 0,
        ticketCapacity: form.value.ticketCapacity ? Number(form.value.ticketCapacity) : null,
        distance: '0 km'
    })

    isSubmitting.value = false

    // Notifier l'admin si événement en attente de validation
    if (status === 'pending') {
        const adminPhone = import.meta.env.VITE_ADMIN_PHONE || '+2250748348221'
        const organizer = form.value.organizer || organizerName.value || userStore.user?.name || 'Organisateur inconnu'
        const orgPhone = form.value.organizerPhone || userStore.user?.phone || 'N/A'
        const eventTitle = form.value.title || 'Evenement sans titre'
        const eventDate = form.value.date ? new Date(form.value.date).toLocaleString('fr-FR') : 'Non renseignee'
        const message = `Nouvel evenement a valider

Titre : ${eventTitle}
Organisateur : ${organizer}
Telephone : ${orgPhone}
Date : ${eventDate}
Lieu : ${form.value.location || 'Non renseigne'}

Connectez-vous sur /admin/dashboard pour moderer.`
        sendWhatsAppMessage(adminPhone, message).catch(() => {})
    }

    router.push('/organizer')
}

onMounted(() => {
    resume()
    if (!form.value.organizer) form.value.organizer = organizerName.value
})

onUnmounted(() => {
    if (fetchTitleTimeout) clearTimeout(fetchTitleTimeout)
    stopCurrentDictation()
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

      <div v-if="dictationError" class="mb-4 bg-red-500/15 border border-red-500/30 text-red-300 text-sm p-3 rounded-xl">
        {{ dictationError }}
      </div>
      <div v-if="isDictating" class="mb-4 bg-red-500/10 border border-red-500/30 text-red-300 text-sm p-3 rounded-xl flex items-center justify-between gap-3">
        <span class="flex items-center gap-2 min-w-0">
          <span class="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0"></span>
          <span class="truncate">Parlez maintenant : {{ dictationFieldLabels[dictationField] || 'champ' }}{{ dictInterim ? ` - ${dictInterim}` : '' }}</span>
        </span>
        <button @click="stopCurrentDictation" class="text-xs font-bold text-red-200 bg-red-500/20 px-2 py-1 rounded-lg">Stop</button>
      </div>

      <section v-if="step === 1" class="space-y-5">
        <div>
          <h2 class="text-2xl font-bold mb-2">Illustration</h2>
          <p class="text-gray-400 text-sm">Le feed affiche toujours le visuel de l'event. La video YouTube se met plus bas comme musique de fond.</p>
        </div>

        <div>
          <label class="text-xs text-gray-400 font-medium mb-2 block">
            Image de l evenement
          </label>
          <label class="block w-full aspect-[4/5] bg-gray-900 border-2 border-dashed border-gray-700 rounded-2xl cursor-pointer hover:border-primary transition overflow-hidden">
            <img v-if="form.preview || form.mediaUrl" :src="form.preview || form.mediaUrl" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex flex-col items-center justify-center text-gray-500">
              <Camera class="w-14 h-14 mb-3" />
              <span class="font-medium">Ajouter une image</span>
            </div>
            <input type="file" accept="image/*" @change="handleFileChange" class="hidden" />
          </label>
          <button
            v-if="form.preview || form.mediaUrl"
            type="button"
            @click="form.preview = ''; form.image = ''; form.mediaUrl = ''"
            class="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl flex items-center gap-1"
          >
            <X class="w-3.5 h-3.5" /> Retirer l'image
          </button>
          <p v-if="imageError" class="text-red-400 text-sm mt-2">{{ imageError }}</p>
          <input
            v-model="form.mediaUrl"
            type="url"
            placeholder="Ou coller une URL image"
            class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary mt-3"
          />
        </div>
      </section>

      <section v-else-if="step === 2" class="space-y-5">
        <div>
          <h2 class="text-2xl font-bold mb-2">Titre et accroche</h2>
          <p class="text-gray-400 text-sm">Donne une promesse claire et courte.</p>
        </div>
        <div class="flex gap-2">
          <input v-model="form.title" type="text" placeholder="Titre de l'evenement" class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          <button
            type="button"
            @click="toggleDictation('title')"
            class="px-3 rounded-xl transition"
            :class="isDictating && dictationField === 'title' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary'"
            title="Dicter le titre"
          >
            <MicOff v-if="isDictating && dictationField === 'title'" class="w-5 h-5" />
            <Mic v-else class="w-5 h-5" />
          </button>
        </div>
        <div class="flex gap-2">
          <input v-model="form.promoText" type="text" placeholder="Texte promo court / promotion" class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          <button
            type="button"
            @click="toggleDictation('promoText')"
            class="px-3 rounded-xl transition"
            :class="isDictating && dictationField === 'promoText' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary'"
            title="Dicter la promotion"
          >
            <MicOff v-if="isDictating && dictationField === 'promoText'" class="w-5 h-5" />
            <Mic v-else class="w-5 h-5" />
          </button>
        </div>
        <div class="space-y-1">
          <label class="text-xs text-gray-400 font-medium">Organisateur</label>
          <div class="flex gap-2">
            <input v-model="form.organizer" type="text" placeholder="Nom de l'organisateur" class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
            <button
              type="button"
              @click="toggleDictation('organizer')"
              class="px-3 rounded-xl transition"
              :class="isDictating && dictationField === 'organizer' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary'"
              title="Dicter l'organisateur"
            >
              <MicOff v-if="isDictating && dictationField === 'organizer'" class="w-5 h-5" />
              <Mic v-else class="w-5 h-5" />
            </button>
          </div>
        </div>
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
        <div class="flex gap-2">
          <input v-model="form.location" type="text" placeholder="Nom du lieu ou point de vente" class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          <button
            type="button"
            @click="toggleDictation('location')"
            class="px-3 rounded-xl transition"
            :class="isDictating && dictationField === 'location' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary'"
            title="Dicter le lieu"
          >
            <MicOff v-if="isDictating && dictationField === 'location'" class="w-5 h-5" />
            <Mic v-else class="w-5 h-5" />
          </button>
        </div>
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
          <h2 class="text-2xl font-bold mb-2">Details admin</h2>
          <p class="text-gray-400 text-sm">Description, tags, premium, reservation et musique de fond.</p>
        </div>
        <!-- Catégorie (boutons pills, plus visibles que select) -->
        <div class="space-y-2">
          <label class="text-xs text-gray-400 font-medium flex items-center gap-1">
            <Tag class="w-3.5 h-3.5" />
            Catégorie de l'événement
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="cat in EVENT_CATEGORIES"
              :key="cat.v"
              type="button"
              @click="form.category = form.category === cat.v ? '' : cat.v"
              class="px-3 py-2 rounded-full text-xs font-bold transition border"
              :class="form.category === cat.v ? 'bg-primary/20 text-primary border-primary/50' : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'"
            >
              {{ cat.emoji }} {{ cat.l }}
            </button>
          </div>
          <p v-if="!form.category" class="text-[10px] text-gray-500">Aide la recommandation. Sinon déduit automatiquement du titre.</p>
        </div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs text-gray-400 font-medium">Description</label>
            <button
              type="button"
              @click="toggleDictation('description')"
              class="p-2 rounded-lg transition"
              :class="isDictating && dictationField === 'description' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary'"
              title="Dicter la description"
            >
              <MicOff v-if="isDictating && dictationField === 'description'" class="w-4 h-4" />
              <Mic v-else class="w-4 h-4" />
            </button>
          </div>
          <textarea v-model="form.description" rows="5" placeholder="Ambiance, programme, infos pratiques..." class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary resize-none"></textarea>
        </div>
        <div>
          <label class="text-xs text-gray-400 font-medium mb-2 flex items-center gap-1">
            <Tag class="w-3.5 h-3.5" />
            Tags / Features
          </label>
          <div class="flex flex-wrap gap-2 mb-3">
            <button
              v-for="tag in predefinedTags"
              :key="tag"
              type="button"
              @click="toggleTag(tag)"
              class="px-3 py-1.5 rounded-full text-xs font-bold transition border"
              :class="form.features.includes(tag) ? 'bg-primary/20 text-primary border-primary/50' : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'"
            >
              {{ form.features.includes(tag) ? '' : '+' }} {{ tag }}
            </button>
          </div>
          <div class="flex gap-2">
            <input
              v-model="customTagInput"
              type="text"
              placeholder="Ajouter un tag personnalise"
              class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary"
              @keydown.enter.prevent="addCustomTag"
            />
            <button type="button" @click="addCustomTag" class="px-3 bg-gray-800 text-gray-400 hover:text-primary rounded-xl transition" title="Ajouter le tag">
              <Plus class="w-5 h-5" />
            </button>
            <button
              type="button"
              @click="toggleDictation('customTag')"
              class="px-3 rounded-xl transition"
              :class="isDictating && dictationField === 'customTag' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary'"
              title="Dicter un tag"
            >
              <MicOff v-if="isDictating && dictationField === 'customTag'" class="w-5 h-5" />
              <Mic v-else class="w-5 h-5" />
            </button>
          </div>
          <input v-model="tagsInput" type="text" placeholder="Tags separes par des virgules" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary mt-3" />
          <div v-if="form.features.length" class="flex flex-wrap gap-1.5 mt-3">
            <span v-for="(tag, idx) in form.features" :key="tag" class="bg-primary/20 text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
              {{ tag }}
              <button type="button" @click="removeTag(idx)" class="hover:text-red-300 transition">
                <X class="w-3 h-3" />
              </button>
            </span>
          </div>
        </div>
        <label class="w-full flex items-center justify-between bg-gray-900 border border-gray-700 rounded-xl p-4 cursor-pointer">
          <span class="font-medium">Evenement Premium</span>
          <input type="checkbox" v-model="form.isPremium" class="w-5 h-5 accent-primary" />
        </label>
        <input
          v-if="form.isPremium"
          v-model.number="form.price"
          type="number"
          min="0"
          step="500"
          placeholder="Prix premium CFA"
          class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary"
        />

        <label class="w-full flex items-center justify-between bg-gray-900 border border-gray-700 rounded-xl p-4 cursor-pointer">
          <span class="font-medium">Preparer la reservation</span>
          <input type="checkbox" v-model="form.ticketingEnabled" class="w-5 h-5 accent-primary" />
        </label>
        <div v-if="form.ticketingEnabled" class="grid grid-cols-2 gap-3">
          <input v-model.number="form.ticketPrice" type="number" min="0" step="500" placeholder="Prix CFA" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          <input v-model.number="form.ticketCapacity" type="number" min="1" placeholder="Capacite" class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
        </div>

        <div class="space-y-2">
          <label class="text-xs text-gray-400 font-medium flex items-center gap-1">
            <Music class="w-3.5 h-3.5" />
            Musique de fond YouTube
          </label>
          <input
            v-model="form.backgroundMusic"
            type="url"
            placeholder="https://www.youtube.com/watch?v=... ou /shorts/..."
            class="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary"
          />
          <div v-if="form.backgroundMusic && extractYouTubeId(form.backgroundMusic)" class="rounded-xl overflow-hidden border border-gray-700">
            <iframe
              :src="`https://www.youtube.com/embed/${extractYouTubeId(form.backgroundMusic)}?rel=0`"
              class="w-full h-32"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
          <p v-if="form.backgroundMusic && !extractYouTubeId(form.backgroundMusic)" class="text-red-400 text-xs">URL YouTube invalide. Formats acceptes : youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...</p>
        </div>

        <div v-if="form.backgroundMusic && extractYouTubeId(form.backgroundMusic)" class="space-y-1">
          <label class="text-xs text-gray-400 font-medium flex items-center gap-1">
            Titre de la musique
            <Loader2 v-if="isFetchingTitle" class="w-3 h-3 animate-spin text-primary" />
          </label>
          <div class="flex gap-2">
            <input v-model="form.musicTitle" type="text" placeholder="Titre de la musique" class="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
            <button
              type="button"
              @click="toggleDictation('musicTitle')"
              class="px-3 rounded-xl transition"
              :class="isDictating && dictationField === 'musicTitle' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary'"
              title="Dicter le titre de la musique"
            >
              <MicOff v-if="isDictating && dictationField === 'musicTitle'" class="w-5 h-5" />
              <Mic v-else class="w-5 h-5" />
            </button>
          </div>
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
            <div class="flex flex-wrap gap-2 pt-2">
              <span v-if="form.category" class="bg-white/10 text-white text-xs px-2 py-1 rounded-full">{{ form.category }}</span>
              <span v-if="form.backgroundMusic" class="bg-primary/15 text-primary text-xs px-2 py-1 rounded-full">Musique</span>
              <span v-if="form.isPremium" class="bg-amber-500/15 text-amber-300 text-xs px-2 py-1 rounded-full">Premium - {{ form.price || 0 }} CFA</span>
            </div>
            <div v-if="selectedTags.length" class="flex flex-wrap gap-2 pt-2">
              <span v-for="tag in selectedTags" :key="tag" class="bg-white/10 text-white text-xs px-2 py-1 rounded-full">{{ tag }}</span>
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
