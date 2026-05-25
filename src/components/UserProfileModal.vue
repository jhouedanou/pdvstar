<script setup>
import { ref, onMounted } from 'vue'
import { useUserStore } from '../stores/userStore'
import { processImage } from '../utils/imageUpload'
import { Phone, User, MapPin, Camera, Loader2, ShieldCheck, UserCheck, UserPlus } from 'lucide-vue-next'
import { sendOtp, verifyOtp } from '../services/otpService'
import { findUserByPhone } from '../services/supabase'
import PhoneInput from './PhoneInput.vue'

const userStore = useUserStore()
const emit = defineEmits(['profile-created'])

const step = ref('form') // 'form' | 'exists' | 'otp'
const existingUser = ref(null)
const isLoginMode = ref(false) // true = se reconnecter à compte existant

const formData = ref({
    phone: '',
    name: '',
    city: '',
    district: '',
    consentData: false,
    photo: null,
    photoPreview: ''
})

const otpCode = ref('')
const isLoading = ref(false)
const isSendingOtp = ref(false)
const isLocating = ref(false)
const error = ref('')
const imageError = ref('')
const resendCooldown = ref(0)
let cooldownTimer = null

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

const startCooldown = () => {
    resendCooldown.value = 60
    clearInterval(cooldownTimer)
    cooldownTimer = setInterval(() => {
        resendCooldown.value--
        if (resendCooldown.value <= 0) clearInterval(cooldownTimer)
    }, 1000)
}

const handleSubmit = async () => {
    error.value = ''
    if (!formData.value.phone.trim()) { error.value = 'Le numero de telephone est requis'; return }
    if (!formData.value.name.trim()) { error.value = 'Un pseudo est requis'; return }

    localStorage.setItem('last_phone_input', formData.value.phone)
    localStorage.setItem('last_name_input', formData.value.name)

    isSendingOtp.value = true
    try {
        // Vérifier si compte existe déjà
        const existing = await findUserByPhone(formData.value.phone)
        if (existing) {
            existingUser.value = existing
            step.value = 'exists'
            return
        }
        // Nouveau compte : envoyer OTP direct
        await sendOtp(formData.value.phone)
        isLoginMode.value = false
        step.value = 'otp'
        startCooldown()
    } catch (err) {
        console.error('OTP send failed:', err)
        error.value = `Echec envoi: ${err.message || 'inconnu'}`
    } finally {
        isSendingOtp.value = false
    }
}

const handleLoginExisting = async () => {
    error.value = ''
    isSendingOtp.value = true
    try {
        await sendOtp(formData.value.phone)
        isLoginMode.value = true
        step.value = 'otp'
        startCooldown()
    } catch (err) {
        console.error('OTP send failed:', err)
        error.value = `Echec envoi: ${err.message || 'inconnu'}`
    } finally {
        isSendingOtp.value = false
    }
}

const handleUseAnotherNumber = () => {
    existingUser.value = null
    formData.value.phone = '+225'
    step.value = 'form'
    error.value = ''
}

const handleVerifyOtp = async () => {
    error.value = ''
    if (!otpCode.value.trim()) { error.value = 'Entrez le code reçu'; return }

    const result = verifyOtp(formData.value.phone, otpCode.value)
    if (!result.valid) {
        if (result.reason === 'expired') error.value = 'Code expiré. Renvoyez un nouveau code.'
        else error.value = 'Code incorrect. Réessayez.'
        return
    }

    isLoading.value = true
    try {
        // Mode login : utiliser le compte existant (authenticate find par phone)
        // Mode register : crée nouveau compte
        const payload = isLoginMode.value && existingUser.value
            ? {
                name: existingUser.value.name,
                pseudo: existingUser.value.pseudo || existingUser.value.name,
                phone: formData.value.phone
              }
            : {
                name: formData.value.name,
                pseudo: formData.value.name,
                phone: formData.value.phone,
                city: formData.value.city,
                district: formData.value.district,
                consentData: formData.value.consentData,
                email: '',
                avatar: formData.value.photoPreview
              }
        await userStore.authenticate(payload)
        emit('profile-created')
    } catch (err) {
        console.error(err)
        error.value = 'Erreur lors de la connexion'
    } finally {
        isLoading.value = false
    }
}

const handleResendOtp = async () => {
    if (resendCooldown.value > 0) return
    error.value = ''
    isSendingOtp.value = true
    try {
        await sendOtp(formData.value.phone)
        startCooldown()
        otpCode.value = ''
    } catch {
        error.value = 'Erreur lors de l\'envoi. Réessayez.'
    } finally {
        isSendingOtp.value = false
    }
}
</script>

<template>
  <div data-pdv-modal="profile" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-800 transition-colors duration-300">

      <!-- Step: form -->
      <template v-if="step === 'form'">
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
            <PhoneInput v-model="formData.phone" />
            <p class="text-[10px] text-gray-500 mt-1.5 ml-1">Un code de verification sera envoye sur WhatsApp.</p>
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

          <div v-if="error" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl text-center font-medium">{{ error }}</div>

          <button
            type="submit"
            :disabled="isSendingOtp"
            class="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-black font-black text-lg py-4 rounded-full transition-all active:scale-95 shadow-xl shadow-primary/20 mt-4 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="isSendingOtp" class="w-5 h-5 animate-spin" />
            <span>{{ isSendingOtp ? 'Envoi du code...' : 'Recevoir le code' }}</span>
          </button>
        </form>

        <p class="text-[10px] text-gray-400 text-center mt-6">En continuant, tu acceptes nos conditions d'utilisation.</p>
      </template>

      <!-- Step: Compte existant détecté -->
      <template v-else-if="step === 'exists'">
        <div class="mb-6 text-center">
          <UserCheck class="w-12 h-12 text-primary mx-auto mb-3" />
          <h2 class="text-xl font-black text-gray-900 dark:text-white">Compte existant</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-2">
            Un compte est déjà associé à
          </p>
          <p class="font-bold text-gray-800 dark:text-gray-200 mt-1">{{ formData.phone }}</p>
          <div class="bg-gray-100 dark:bg-gray-800 rounded-xl p-3 mt-4">
            <p class="text-xs text-gray-500 dark:text-gray-400">Pseudo enregistré</p>
            <p class="font-bold text-gray-800 dark:text-gray-200">{{ existingUser?.pseudo || existingUser?.name || 'Utilisateur' }}</p>
          </div>
        </div>

        <p v-if="error" class="text-red-500 text-sm text-center mb-3 bg-red-50 dark:bg-red-900/20 rounded-xl p-2">{{ error }}</p>

        <div class="space-y-3">
          <button
            @click="handleLoginExisting"
            :disabled="isSendingOtp"
            class="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition active:scale-95"
          >
            <Loader2 v-if="isSendingOtp" class="w-5 h-5 animate-spin" />
            <ShieldCheck v-else class="w-5 h-5" />
            <span>Me reconnecter</span>
          </button>
          <button
            @click="handleUseAnotherNumber"
            :disabled="isSendingOtp"
            class="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition"
          >
            <UserPlus class="w-5 h-5" />
            <span>Créer un autre compte</span>
          </button>
        </div>

        <p class="text-[10px] text-gray-400 text-center mt-5">
          Un code de vérification sera envoyé par WhatsApp pour confirmer.
        </p>
      </template>

      <!-- Step: OTP verification -->
      <template v-else>
        <div class="mb-6 text-center">
          <ShieldCheck class="w-12 h-12 text-primary mx-auto mb-3" />
          <h2 class="text-xl font-black text-gray-900 dark:text-white">Vérification</h2>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Code envoyé sur WhatsApp au<br />
            <span class="font-semibold text-gray-700 dark:text-gray-300">{{ formData.phone }}</span>
          </p>
        </div>

        <div class="space-y-5">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 text-center">Code à 6 chiffres</label>
            <input
              v-model="otpCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="_ _ _ _ _ _"
              @keyup.enter="handleVerifyOtp"
              class="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl px-4 py-4 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-center text-2xl font-mono tracking-[0.5em]"
            />
          </div>

          <div v-if="error" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl text-center font-medium">{{ error }}</div>

          <button
            @click="handleVerifyOtp"
            :disabled="isLoading"
            class="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-black font-black text-lg py-4 rounded-full transition-all active:scale-95 shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
          >
            <Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
            <span>{{ isLoading ? 'Vérification...' : 'Confirmer' }}</span>
          </button>

          <div class="text-center space-y-2">
            <button
              @click="handleResendOtp"
              :disabled="resendCooldown > 0 || isSendingOtp"
              class="text-sm text-primary disabled:text-gray-400 transition"
            >
              <Loader2 v-if="isSendingOtp" class="w-3 h-3 animate-spin inline mr-1" />
              {{ resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : 'Renvoyer le code' }}
            </button>
            <br />
            <button @click="step = 'form'; error = ''; otpCode = ''; existingUser = null; isLoginMode = false" class="text-xs text-gray-400 hover:text-gray-200 transition">
              ← Modifier le numéro
            </button>
          </div>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
input::placeholder {
  color: rgba(156, 163, 175, 0.6);
}
</style>
