<script setup>
import { ref } from 'vue'
import { useUserStore } from '../stores/userStore'
import { Phone, User, Mail } from 'lucide-vue-next'

const userStore = useUserStore()

// Define emits
const emit = defineEmits(['profile-created'])

const formData = ref({
    name: '',
    phone: '+22545029721',
    email: ''
})

const isLoading = ref(false)
const error = ref('')

const handleSubmit = async () => {
    error.value = ''
    
    if (!formData.value.name.trim()) {
        error.value = 'Le nom est requis'
        return
    }

    if (!formData.value.phone.trim()) {
        error.value = 'Le téléphone est requis'
        return
    }

    isLoading.value = true
    try {
        userStore.createProfile({
            name: formData.value.name,
            phone: formData.value.phone,
            email: formData.value.email
        })
        
        // Emit event to parent to close modal
        emit('profile-created')
        isLoading.value = false
    } catch (err) {
        error.value = 'Erreur lors de la création du profil'
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
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <!-- Name Field -->
        <div>
          <label class="block text-sm font-semibold text-gray-300 mb-2">Nom complet</label>
          <div class="relative">
            <User class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              v-model="formData.name"
              type="text"
              placeholder="Votre nom"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
            />
          </div>
        </div>

        <!-- Phone Field -->
        <div>
          <label class="block text-sm font-semibold text-gray-300 mb-2">Téléphone Pro</label>
          <div class="relative">
            <Phone class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              v-model="formData.phone"
              type="tel"
              placeholder="+22545029721"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
            />
          </div>
          <p class="text-xs text-gray-500 mt-1">Format: +[pays][numéro]</p>
        </div>

        <!-- Email Field -->
        <div>
          <label class="block text-sm font-semibold text-gray-300 mb-2">Email (optionnel)</label>
          <div class="relative">
            <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              v-model="formData.email"
              type="email"
              placeholder="votre@email.com"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
            />
          </div>
        </div>

        <!-- Error Message -->
        <div v-if="error" class="bg-red-900/30 border border-red-700 rounded-lg p-3">
          <p class="text-red-400 text-sm">{{ error }}</p>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-700 text-black font-bold py-3 rounded-lg transition duration-200 mt-6"
        >
          {{ isLoading ? 'Création...' : 'Créer mon profil' }}
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
