<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGeolocation } from '@vueuse/core'
import { useEventStore } from '../stores/eventStore'
import { Camera, Mic, MapPin, Check, ArrowRight, Loader2, Calendar, FileText, Type } from 'lucide-vue-next'

const router = useRouter()
const store = useEventStore()
const { coords, resume } = useGeolocation()

// State
const step = ref(1)
const steps = [
    { title: "Photo", icon: Camera },
    { title: "Titre", icon: Type },
    { title: "Date", icon: Calendar },
    { title: "Description", icon: FileText },
    { title: "Validation", icon: Check }
]

const form = ref({
    title: '',
    description: '',
    date: new Date().toISOString().slice(0, 16), // datetime-local format
    image: null,
    preview: ''
})

const isRecording = ref(false)
const isTranscribing = ref(false)

// Step 1: Media
const handleFileChange = (e) => {
  const file = e.target.files[0]
  if (file) {
    form.value.image = file
    const reader = new FileReader()
    reader.onload = (ev) => {
        form.value.preview = ev.target.result
        nextStep()
    }
    reader.readAsDataURL(file)
  }
}

// Voice Logic (Generic)
let mediaRecorder = null
let recognition = null

// Check for SpeechRecognition (better for field inputs)
if ('webkitSpeechRecognition' in window) {
    recognition = new window.webkitSpeechRecognition()
    recognition.continuous = false
    recognition.lang = 'fr-FR'
    recognition.interimResults = false
}

const startDictation = (field) => {
    if (recognition) {
        isRecording.value = true
        recognition.onresult = (event) => {
            const text = event.results[0][0].transcript
            form.value[field] = text
        }
        recognition.onend = () => {
            isRecording.value = false
        }
        recognition.start()
    } else {
        // Fallback or simple mock for prototype
        alert("Dictée vocale non supportée sur ce navigateur, simulation...")
        isRecording.value = true
        setTimeout(() => {
            form.value[field] = field === 'title' ? "Soirée Black & White" : "Venez nombreux pour une soirée inoubliable avec DJ Snake !"
            isRecording.value = false
        }, 1500)
    }
}

// Navigation
const nextStep = () => {
    if (step.value < steps.length) step.value++
}

const prevStep = () => {
    if (step.value > 1) step.value--
}

// Publish
const publishEvent = () => {
    store.addEvent({
        title: form.value.title || 'Événement Sans Titre',
        description: form.value.description || 'Pas de description',
        date: form.value.date,
        image: form.value.preview,
        location: 'Ma Position (Mobile)',
        coords: {
            lat: coords.value.latitude !== Infinity ? coords.value.latitude : 5.30966,
            lng: coords.value.longitude !== Infinity ? coords.value.longitude : -3.97449
        },
        distance: '0 km'
    })
    router.push('/')
}

onMounted(() => {
    resume()
})
</script>

<template>
  <div class="h-screen bg-black flex flex-col items-center justify-between p-6 relative overflow-hidden">
    
    <!-- Progress Bar -->
    <div class="w-full flex gap-1 mb-8 pt-4">
        <div v-for="i in steps.length" :key="i" 
             class="h-1 flex-1 rounded-full transition-all duration-300"
             :class="i <= step ? 'bg-primary' : 'bg-gray-800'">
        </div>
    </div>

    <!-- Steps -->
    <div class="flex-1 w-full max-w-md flex flex-col justify-center">
        
        <!-- Step 1: Image -->
        <div v-if="step === 1" class="flex flex-col items-center animate-in slide-in-from-right fade-in duration-300">
            <h2 class="text-3xl font-bold text-white mb-2">L'affiche ? 📸</h2>
            <p class="text-gray-400 mb-8">Montre-nous à quoi ça ressemble.</p>
            
            <label class="w-full aspect-square bg-gray-900 border-2 border-dashed border-gray-700 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-gray-800 transition group">
                <div v-if="form.preview" class="w-full h-full p-2">
                    <img :src="form.preview" class="w-full h-full object-cover rounded-2xl" />
                </div>
                <div v-else class="flex flex-col items-center">
                    <Camera class="w-16 h-16 text-gray-600 group-hover:text-primary transition mb-4" />
                    <span class="text-gray-500 font-medium">Toucher pour ajouter</span>
                </div>
                <input type="file" accept="image/*" @change="handleFileChange" class="hidden" />
            </label>
        </div>

        <!-- Step 2: Title -->
        <div v-else-if="step === 2" class="flex flex-col items-center animate-in slide-in-from-right fade-in duration-300">
            <h2 class="text-3xl font-bold text-white mb-2">Le titre ? ✨</h2>
            
            <div class="w-full relative mt-8">
                <input v-model="form.title" type="text" placeholder="Ex: Soirée Mousse..." class="w-full bg-transparent border-b-2 border-gray-700 text-3xl font-bold text-center text-white pb-2 focus:outline-none focus:border-primary transition" />
                <button @click="startDictation('title')" class="absolute right-0 bottom-2 text-primary p-2 hover:bg-white/10 rounded-full transition" :class="{'animate-pulse bg-red-500/20': isRecording}">
                    <Mic class="w-6 h-6" />
                </button>
            </div>
        </div>

        <!-- Step 3: Date -->
        <div v-else-if="step === 3" class="flex flex-col items-center animate-in slide-in-from-right fade-in duration-300">
            <h2 class="text-3xl font-bold text-white mb-8">C'est quand ? 📅</h2>
            <input v-model="form.date" type="datetime-local" class="bg-gray-900 text-white text-xl p-4 rounded-xl border border-gray-700 focus:border-primary outline-none w-full text-center" />
        </div>

        <!-- Step 4: Description -->
        <div v-else-if="step === 4" class="flex flex-col items-center animate-in slide-in-from-right fade-in duration-300">
            <h2 class="text-3xl font-bold text-white mb-2">Des détails ? 📝</h2>
            <p class="text-gray-400 mb-8">Ambiance, prix, dress code...</p>

            <div class="w-full relative">
                <textarea v-model="form.description" rows="5" class="w-full bg-gray-900 text-white rounded-xl p-4 border border-gray-700 focus:border-primary outline-none text-lg resize-none" placeholder="Dites-nous en plus..."></textarea>
                <button @click="startDictation('description')" class="absolute right-2 bottom-2 bg-primary p-3 rounded-full text-black hover:scale-105 transition" :class="{'animate-pulse bg-red-500': isRecording}">
                    <Mic class="w-6 h-6" />
                </button>
            </div>
        </div>

        <!-- Step 5: Review -->
        <div v-else-if="step === 5" class="flex flex-col items-center animate-in slide-in-from-right fade-in duration-300">
            <h2 class="text-3xl font-bold text-white mb-6">On publie ? 🚀</h2>
            
            <div class="w-full bg-gray-900 rounded-2xl overflow-hidden border border-gray-800">
                <img :src="form.preview" class="w-full h-48 object-cover" />
                <div class="p-4">
                    <h3 class="text-xl font-bold text-white">{{ form.title }}</h3>
                    <p class="text-primary text-sm mb-2">{{ new Date(form.date).toLocaleString() }}</p>
                    <p class="text-gray-400 text-sm line-clamp-3">{{ form.description }}</p>
                </div>
            </div>
        </div>

    </div>

    <!-- Navigation Area -->
    <div class="w-full pt-6 flex justify-between items-center">
        <button v-if="step > 1" @click="prevStep" class="text-gray-500 font-medium hover:text-white transition">
            Retour
        </button>
        <div v-else></div> <!-- Spacer -->

        <button v-if="step < 5" @click="nextStep" class="bg-primary text-black px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed" :disabled="step === 1 && !form.preview">
            Suivant <ArrowRight class="w-5 h-5" />
        </button>
        <button v-else @click="publishEvent" class="bg-green-500 text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition shadow-lg shadow-green-500/20">
            Publier <Check class="w-5 h-5" />
        </button>
    </div>

  </div>
</template>
