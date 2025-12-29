<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGeolocation } from '@vueuse/core'
import { useEventStore } from '../stores/eventStore'
import { Camera, Mic, MapPin, Check, ArrowRight, Loader2 } from 'lucide-vue-next'

const router = useRouter()
const store = useEventStore()
const { coords, resume } = useGeolocation()

// State
const step = ref(1)
const mediaFile = ref(null)
const mediaPreview = ref('')
const isRecording = ref(false)
const transcription = ref('')
const isTranscribing = ref(false)
const eventLocation = ref('Detecting location...')

// Step 1: Media Capture
const handleFileChange = (e) => {
  const file = e.target.files[0]
  if (file) {
    mediaFile.value = file
    // Convert to Base64 for persistence
    const reader = new FileReader()
    reader.onload = (e) => {
        mediaPreview.value = e.target.result
        step.value = 2 // Auto advance
    }
    reader.readAsDataURL(file)
  }
}

// Step 2: Voice
let mediaRecorder = null
let chunks = []

const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorder = new MediaRecorder(stream)
        chunks = []
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
        mediaRecorder.onstop = async () => {
            // const blob = new Blob(chunks, { type: 'audio/webm' })
            // Simulate API call to Whisper
            isTranscribing.value = true
            setTimeout(() => {
                transcription.value = "Soirée Afrobeat ce Samedi à 21h. Entrée gratuite pour les filles avant minuit. Venez nombreux !"
                isTranscribing.value = false
                step.value = 3 // Auto advance
            }, 2000)
        }
        mediaRecorder.start()
        isRecording.value = true
    } catch (err) {
        alert("Microphone access denied.")
    }
}

const stopRecording = () => {
    if (mediaRecorder && isRecording.value) {
        mediaRecorder.stop()
        isRecording.value = false
    }
}

// Step 3: Location & Confirm
onMounted(() => {
    resume() // Ensure location is watching
})

const currentLocationConfig = computed(() => {
     if (coords.value.latitude === Infinity) return "Localisation en cours..."
     // Mock reverse geocoding
     return `Lat: ${coords.value.latitude.toFixed(4)}, Lng: ${coords.value.longitude.toFixed(4)}`
})

const publishEvent = () => {
    // Determine title from transcription or default
    let title = "Nouvel Événement"
    if (transcription.value.length < 50) {
        title = transcription.value
    }

    store.addEvent({
        title: title,
        description: transcription.value || 'Pas de description',
        image: mediaPreview.value, // Now Base64
        location: 'Ma Position (Mobile)',
        coords: {
            lat: coords.value.latitude !== Infinity ? coords.value.latitude : 5.30966,
            lng: coords.value.longitude !== Infinity ? coords.value.longitude : -3.97449
        },
        distance: '0 km'
    })
    router.push('/')
}
</script>

<template>
  <div class="h-screen bg-black flex flex-col items-center justify-center p-4 relative">
    
    <!-- Step 1: CAMERA -->
    <div v-if="step === 1" class="w-full h-full flex flex-col items-center justify-center">
        <h2 class="text-white text-3xl font-bold mb-8 text-center">Montre-nous l'affiche <br>ou le lieu 📸</h2>
        
        <label class="w-64 h-64 border-4 border-primary rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition bg-surface">
            <Camera class="w-20 h-20 text-primary mb-4" />
            <span class="text-xl font-bold">Toucher ici</span>
            <input type="file" accept="image/*" capture="environment" @change="handleFileChange" class="hidden" />
        </label>
    </div>

    <!-- Step 2: VOICE -->
    <div v-else-if="step === 2" class="w-full flex flex-col items-center">
        <!-- Preview Image Small -->
        <img :src="mediaPreview" class="w-32 h-32 rounded-xl object-cover mb-8 border-2 border-white/50" />

        <h2 class="text-white text-2xl font-bold mb-2 text-center">Dis-nous tout ! 🎙️</h2>
        <p class="text-gray-400 text-center mb-8 px-4">"C'est quoi ? C'est quand ? Y'a une promo ?"</p>

        <div v-if="isTranscribing" class="flex flex-col items-center">
             <Loader2 class="w-16 h-16 text-primary animate-spin mb-4"/>
             <span class="text-xl animate-pulse">L'IA écoute...</span>
        </div>

        <button v-else
            @mousedown="startRecording" 
            @touchstart.prevent="startRecording"
            @mouseup="stopRecording" 
            @touchend.prevent="stopRecording"
            class="w-32 h-32 rounded-full flex items-center justify-center transition-all duration-200"
            :class="isRecording ? 'bg-red-600 scale-110 ring-8 ring-red-900' : 'bg-primary'"
        >
            <Mic class="w-16 h-16" :class="isRecording ? 'text-white' : 'text-black'"/>
        </button>
        <p class="mt-4 text-gray-500">Maintenir pour parler</p>
    </div>

    <!-- Step 3: CONFIRM -->
    <div v-else-if="step === 3" class="w-full flex flex-col h-full pt-10">
        <h2 class="text-primary text-3xl font-bold mb-6">C'est bon ?</h2>
        
        <div class="bg-surface p-4 rounded-xl mb-4 flex gap-4">
            <img :src="mediaPreview" class="w-20 h-20 rounded-lg object-cover" />
            <div>
                <p class="text-gray-400 text-sm">Description capturée :</p>
                <p class="text-lg italic">"{{ transcription }}"</p>
            </div>
        </div>

        <div class="bg-surface p-4 rounded-xl mb-auto flex items-center gap-3">
             <MapPin class="text-secondary w-8 h-8"/>
             <div>
                 <p class="text-gray-400 text-sm">Lieu détecté :</p>
                 <p class="text-xl font-bold">{{ currentLocationConfig }}</p>
             </div>
        </div>

        <button @click="publishEvent" class="w-full bg-primary text-black font-bold text-2xl py-4 rounded-full shadow-xl flex items-center justify-center gap-2 mb-8">
            Publier <Check class="w-8 h-8"/>
        </button>
    </div>

    <!-- Back Button -->
    <button v-if="step > 1" @click="step--" class="absolute top-4 left-4 text-gray-500">
        Retour
    </button>
  </div>
</template>
