<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore'
import { processImage } from '../utils/imageUpload'
import { Phone, User, MapPin, Camera, Loader2 } from 'lucide-vue-next'

const userStore = useUserStore()
const emit = defineEmits(['profile-created'])

const formData = ref({
    phone: '',
    name: '',
    city: '',
    district: '',
    consentData: false,
    photo: null,
    photoPreview: ''
})

const isLoading = ref(false)
const isLocating = ref(false)
const error = ref('')
const imageError = ref('')

onMounted(async () => {
    const savedPhone = localStorage.getItem('last_phone_input')
    const savedName = localStorage.getItem('last_name_input')

    if (savedPhone) formData.value.phone = savedPhone
    if (savedName) formData.value.name = savedName

    if (!savedPhone) {
        isLocating.value = true
        try {
            const response = await fetch('https://ipapi.co/json/')
            const data = await response.json()
            formData.value.phone = data.country_calling_code || '+225'
            formData.value.city = data.city || ''
        } catch {
            formData.value.phone = '+225'
        } finally {
            isLocating.value = false
        }
    }
})

const handlePhotoChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    imageError.value = ''
    const result = await processImage(file, { maxWidth: 400, maxHeight: 400 })
    if (!result.success) {
        imageError.value = result.error
        return
    }
    formData.value.photoPreview = result.data
    formData.value.photo = file
}

const handleSubmit = async () => {
    error.value = ''

    if (!formData.value.phone.trim()) {
        error.value = 'Le numero de telephone est requis'
        return
    }

    if (!formData.value.name.trim()) {
        error.value = 'Un pseudo est requis'
        return
    }

    localStorage.setItem('last_phone_input', formData.value.phone)
    localStorage.setItem('last_name_input', formData.value.name)

    isLoading.value = true
    try {
        await userStore.authenticate({
            name: formData.value.name,
            pseudo: formData.value.name,
            phone: formData.value.phone,
            city: formData.value.city,
            district: formData.value.district,
            consentData: formData.value.consentData,
            email: '',
            avatar: formData.value.photoPreview
        })
        emit('profile-created')
    } catch (err) {
        console.error(err)
        error.value = 'Erreur lors de la connexion'
    } finally {
        isLoading.value = false
    }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-800 transition-colors duration-300">
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-black tracking-tight text-gray-900 dark:text-white mb-1">BABI VIBES</h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm">Cree ton profil rapide pour continuer</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-5">
        <div class="flex justify-center">
          <label class="relative w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-primary transition-colors">
            <img v-if="formData.photoPreview" :src="formData.photoPreview" class="w-full h-full object-cover" />
            <div v-else class="flex flex-col items-center text-gray-400 group-hover:text-primary">
              <Camera class="w-8 h-8 mb-1" />
              <span class="text-[10px] font-bold">Photo</span>
            </div>
            <input type="file" accept="image/*" @change="handlePhotoChange" class="hidden" />
          </label>
        </div>
        <p v-if="imageError" class="text-red-500 text-xs text-center font-medium">{{ imageError }}</p>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Pseudo</label>
          <div class="relative">
            <User class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              v-model="formData.name"
              type="text"
              placeholder="Ex: Alex Plateau"
              class="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div>
          <div class="flex justify-between items-center mb-1">
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500">Telephone</label>
            <span v-if="isLocating" class="text-xs text-primary animate-pulse flex items-center gap-1">
              <Loader2 class="w-3 h-3 animate-spin" /> Detection...
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
          <p class="text-[10px] text-gray-500 mt-1.5 ml-1">Utilise pour les confirmations WhatsApp.</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Ville</label>
            <div class="relative">
              <MapPin class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="formData.city"
                type="text"
                placeholder="Abidjan"
                class="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-3 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Quartier</label>
            <input
              v-model="formData.district"
              type="text"
              placeholder="Cocody"
              class="w-full bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        </div>

        <label class="flex items-start gap-3 text-xs text-gray-500 dark:text-gray-400">
          <input v-model="formData.consentData" type="checkbox" class="mt-0.5 accent-primary" />
          <span>J'accepte que Babi Vibes utilise ces informations pour me proposer des evenements pertinents.</span>
        </label>

        <div v-if="error" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl text-center font-medium">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-700 disabled:text-gray-400 text-black font-black text-lg py-4 rounded-full transition-all active:scale-95 shadow-xl shadow-primary/20 mt-4 flex items-center justify-center gap-2"
        >
          <Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
          <span>{{ isLoading ? 'Connexion...' : 'Continuer' }}</span>
        </button>
      </form>

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
