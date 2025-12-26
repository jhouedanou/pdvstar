<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore'
import { Phone, User, Mail, MapPin } from 'lucide-vue-next'

const userStore = useUserStore()

// Define emits
const emit = defineEmits(['profile-created'])

const formData = ref({
    phone: '',
})

const isLoading = ref(false)
const isLocating = ref(false) // State for geolocation loading
const error = ref('')

onMounted(async () => {
    isLocating.value = true
    try {
        // Attempt to get user's country code via IP
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
})

const handleSubmit = async () => {
    error.value = ''
    
    if (!formData.value.phone.trim()) {
        error.value = 'Le numéro de téléphone est requis'
        return
    }

    isLoading.value = true
    try {
        // Mock simple auth - in production this would verify OTP
        userStore.createProfile({
            name: `Utilisateur ${formData.value.phone}`, // Auto-generate name
            phone: formData.value.phone,
            email: ''
        })
        
        // Emit event to parent to close modal
        emit('profile-created')
        isLoading.value = false
    } catch (err) {
        error.value = 'Erreur lors de la connexion'
        isLoading.value = false
    }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-800">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-white mb-2">Bienvenue sur pdvstar 🎉</h1>
        <p class="text-gray-400 text-sm">Complétez votre profil pour commencer</p>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-6">
        
        <!-- Phone Field -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="block text-sm font-semibold text-gray-300">Numéro de Téléphone</label>
            <span v-if="isLocating" class="text-xs text-primary animate-pulse flex items-center gap-1">
                <MapPin class="w-3 h-3" /> Localisation...
            </span>
          </div>
          <div class="relative">
            <Phone class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              v-model="formData.phone"
              type="tel"
              placeholder="+2250700000000"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-4 text-white text-lg placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
            />
          </div>
          <p class="text-xs text-gray-500 mt-2">Nous vous enverrons un code de confirmation.</p>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-900/30 border border-red-700 rounded-lg p-3">
          <p class="text-red-400 text-sm">{{ error }}</p>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-700 text-black font-extrabold text-lg py-4 rounded-full transition duration-200 mt-4 shadow-lg shadow-primary/20"
        >
          {{ isLoading ? 'Connexion...' : 'Entrer' }}
        </button>
      </form>

      <!-- Terms -->
      <p class="text-xs text-gray-500 text-center mt-4">
        En continuant, vous acceptez nos conditions d'utilisation
      </p>
    </div>
  </div>
</template>

<style scoped>
input::placeholder {
  color: rgba(107, 114, 128, 0.7);
}
</style>
