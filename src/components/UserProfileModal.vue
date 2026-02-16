<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore'
import { Phone, User, MapPin, Camera, Loader2 } from 'lucide-vue-next'

const userStore = useUserStore()

// Define emits
const emit = defineEmits(['profile-created'])

const formData = ref({
    phone: '',
    name: '',
    photo: null,
    photoPreview: ''
})

const isLoading = ref(false)
const isLocating = ref(false) // State for geolocation loading
const error = ref('')

onMounted(async () => {
    // 1. Check persistence first (User preference)
    const savedPhone = localStorage.getItem('last_phone_input')
    const savedName = localStorage.getItem('last_name_input')
    
    if (savedPhone) formData.value.phone = savedPhone
    if (savedName) formData.value.name = savedName

    // 2. Fallback to IP detection/saved if not present
    if (!savedPhone) {
        isLocating.value = true
        try {
            const response = await fetch('https://ipapi.co/json/')
            const data = await response.json()
            
            if (data.country_calling_code) {
                formData.value.phone = data.country_calling_code
            } else {
                formData.value.phone = '+225' // Default fallback (Côte d'Ivoire)
            }
        } catch (e) {
            console.error('Geolocation failed', e)
            formData.value.phone = '+225' // Default fallback
        } finally {
            isLocating.value = false
        }
    }
})

const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
            formData.value.photoPreview = e.target.result
        }
        reader.readAsDataURL(file)
        formData.value.photo = file
    }
}

const handleSubmit = async () => {
    error.value = ''
    
    if (!formData.value.phone.trim()) {
        error.value = 'Le numéro de téléphone est requis'
        return
    }
    
    if (!formData.value.name.trim()) {
        error.value = 'Un pseudo est requis (ex: Le Boss du Plateau)'
        return
    }

    // Persist inputs
    localStorage.setItem('last_phone_input', formData.value.phone)
    localStorage.setItem('last_name_input', formData.value.name)

    isLoading.value = true
    try {
        // Login or Register via Supabase
        await userStore.authenticate({
            name: formData.value.name,
            phone: formData.value.phone,
            email: '',
            avatar: formData.value.photoPreview // Base64 or null
        })
        
        // Emit event to parent to close modal
        emit('profile-created')
        isLoading.value = false
    } catch (err) {
        console.error(err)
        error.value = 'Erreur lors de la connexion'
        isLoading.value = false
    }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-800 transition-colors duration-300">
      <!-- Header -->
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-black italic tracking-tighter text-gray-900 dark:text-white mb-1">BABI VIBES 🇨🇮</h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm">Crée ton profil pour entrer dans le game</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-5">
        
        <!-- Photo Upload -->
        <div class="flex justify-center mb-6">
            <label class="relative w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-primary transition-colors">
                <img v-if="formData.photoPreview" :src="formData.photoPreview" class="w-full h-full object-cover" />
                <div v-else class="flex flex-col items-center text-gray-400 group-hover:text-primary">
                    <Camera class="w-8 h-8 mb-1" />
                    <span class="text-[10px] font-bold">Photo</span>
                </div>
                <input type="file" accept="image/*" @change="handlePhotoChange" class="hidden" />
                
                <!-- Overlay on hover if has image -->
                <div v-if="formData.photoPreview" class="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera class="w-6 h-6 text-white" />
                </div>
            </label>
        </div>

        <!-- Username Field -->
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1"> Ton Blaze (Pseudo)</label>
          <div class="relative">
            <User class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              v-model="formData.name"
              type="text"
              placeholder="Ex: DJ Arafat Jr."
              class="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>

        <!-- Phone Field -->
        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500">Ton Contact</label>
            <span v-if="isLocating" class="text-xs text-primary animate-pulse flex items-center gap-1">
                <Loader2 class="w-3 h-3 animate-spin"/> Localisation...
            </span>
          </div>
          <div class="relative">
            <Phone class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              v-model="formData.phone"
              type="tel"
              placeholder="+2250700000000"
              class="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
          <p class="text-[10px] text-gray-500 mt-1.5 ml-1">Pour recevoir les confirmations WhatsApp 📱</p>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl text-center font-medium">
          {{ error }}
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-700 disabled:text-gray-400 text-black font-black text-lg py-4 rounded-full transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-primary/20 mt-4 flex items-center justify-center gap-2"
        >
          <span v-if="isLoading">Connexion...</span>
          <span v-else>C'EST PARTI 🚀</span>
        </button>
      </form>

      <!-- Terms -->
      <p class="text-[10px] text-gray-400 text-center mt-6">
        En continuant, tu acceptes nos conditions d'utilisation.
      </p>
    </div>
  </div>
</template>

<style scoped>
input::placeholder {
  color: rgba(156, 163, 175, 0.6);
}
</style>
