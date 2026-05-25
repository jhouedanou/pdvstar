<script setup>
import { ref } from 'vue'
import { Store, LogIn, UserPlus, Loader2, ShieldCheck } from 'lucide-vue-next'
import { useUserStore } from '../stores/userStore'
import { findUserByPhone } from '../services/supabase'
import { sendOtp, verifyOtp } from '../services/otpService'

const emit = defineEmits(['authenticated'])

const userStore = useUserStore()

const step = ref('form') // 'form' | 'otp'
const tab = ref('login')
const phone = ref('')
const pseudo = ref('')
const spaceName = ref('')
const otpCode = ref('')
const error = ref('')
const isSendingOtp = ref(false)
const isLoading = ref(false)
const resendCooldown = ref(0)
let cooldownTimer = null

// Pending data to use after OTP verification
let pendingAction = null

const formatPhone = (raw) => {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('225')) return '+' + digits
  return '+225' + digits
}

const startCooldown = () => {
  resendCooldown.value = 60
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

const requestOtp = async (fullPhone) => {
  isSendingOtp.value = true
  error.value = ''
  try {
    await sendOtp(fullPhone)
    step.value = 'otp'
    startCooldown()
  } catch (err) {
    console.error('OTP send failed:', err)
    error.value = `Echec envoi: ${err.message || 'inconnu'}`
  } finally {
    isSendingOtp.value = false
  }
}

const handleLogin = async () => {
  error.value = ''
  if (!phone.value.trim()) { error.value = 'Numéro de téléphone requis'; return }
  const fullPhone = formatPhone(phone.value.trim())

  const existing = await findUserByPhone(fullPhone)
  if (!existing) { error.value = 'Aucun compte pro trouvé. Créez un compte.'; return }
  if (existing.role !== 'organizer' && existing.role !== 'admin') {
    error.value = 'Ce numéro n\'est pas associé à un espace pro.'
    return
  }

  pendingAction = { type: 'login', user: existing, phone: fullPhone }
  await requestOtp(fullPhone)
}

const handleRegister = async () => {
  error.value = ''
  if (!phone.value.trim()) { error.value = 'Numéro de téléphone requis'; return }
  if (!spaceName.value.trim()) { error.value = 'Nom de l\'espace requis'; return }

  const fullPhone = formatPhone(phone.value.trim())
  pendingAction = { type: 'register', phone: fullPhone }
  await requestOtp(fullPhone)
}

const handleVerifyOtp = async () => {
  error.value = ''
  if (!otpCode.value.trim()) { error.value = 'Entrez le code reçu'; return }

  const fullPhone = pendingAction?.phone
  const result = verifyOtp(fullPhone, otpCode.value)
  if (!result.valid) {
    if (result.reason === 'expired') error.value = 'Code expiré. Renvoyez un nouveau code.'
    else error.value = 'Code incorrect. Réessayez.'
    return
  }

  isLoading.value = true
  try {
    if (pendingAction.type === 'login') {
      // Re-fetch role à jour avant session (évite stale role)
      const fresh = await findUserByPhone(pendingAction.phone)
      const userToLog = fresh || pendingAction.user
      if (userToLog.role !== 'organizer' && userToLog.role !== 'admin') {
        error.value = 'Rôle modifié — accès refusé.'
        return
      }
      userStore.user = userToLog
      userStore.saveSession?.()
      emit('authenticated', userToLog)
    } else {
      const user = await userStore.authenticate({
        phone: pendingAction.phone,
        name: pseudo.value.trim() || 'Organisateur',
        pseudo: pseudo.value.trim()
      })
      if (!user) { error.value = 'Erreur lors de la création du compte.'; return }

      const success = await userStore.becomeOrganizer({
        spaceName: spaceName.value.trim(),
        organizerName: pseudo.value.trim() || user.name
      })
      if (!success) { error.value = 'Erreur lors de la création de l\'espace.'; return }
      emit('authenticated', userStore.user)
    }
  } finally {
    isLoading.value = false
  }
}

const handleResendOtp = async () => {
  if (resendCooldown.value > 0 || !pendingAction?.phone) return
  isSendingOtp.value = true
  error.value = ''
  try {
    await sendOtp(pendingAction.phone)
    startCooldown()
    otpCode.value = ''
  } catch {
    error.value = 'Erreur lors de l\'envoi. Réessayez.'
  } finally {
    isSendingOtp.value = false
  }
}

const backToForm = () => {
  step.value = 'form'
  error.value = ''
  otpCode.value = ''
  pendingAction = null
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-800 overflow-hidden">

        <!-- Header -->
        <div class="p-6 text-center border-b border-gray-800">
          <Store class="w-10 h-10 text-primary mx-auto mb-2" />
          <h2 class="text-xl font-bold text-white">Espace Pro</h2>
          <p class="text-gray-400 text-sm mt-1">Gérez vos événements</p>
        </div>

        <!-- Step: form -->
        <template v-if="step === 'form'">
          <!-- Tabs -->
          <div class="flex border-b border-gray-800">
            <button
              @click="tab = 'login'; error = ''"
              class="flex-1 py-3 text-sm font-medium transition"
              :class="tab === 'login' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'"
            >
              <LogIn class="w-4 h-4 inline mr-1" />
              Se connecter
            </button>
            <button
              @click="tab = 'register'; error = ''"
              class="flex-1 py-3 text-sm font-medium transition"
              :class="tab === 'register' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'"
            >
              <UserPlus class="w-4 h-4 inline mr-1" />
              Créer un compte
            </button>
          </div>

          <div class="p-6 space-y-4">
            <!-- Phone -->
            <div>
              <label class="block text-gray-400 text-xs mb-1">Numéro de téléphone ivoirien</label>
              <div class="flex">
                <span class="bg-gray-800 border border-r-0 border-gray-700 rounded-l-xl px-3 flex items-center text-gray-400 text-sm font-mono">+225</span>
                <input
                  v-model="phone"
                  type="tel"
                  placeholder="0700000000"
                  class="flex-1 bg-gray-800 text-white px-3 py-3 rounded-r-xl border border-gray-700 focus:border-primary focus:outline-none transition text-sm"
                />
              </div>
              <p class="text-[10px] text-gray-500 mt-1">Un code de vérification sera envoyé sur WhatsApp.</p>
            </div>

            <!-- Register only fields -->
            <template v-if="tab === 'register'">
              <div>
                <label class="block text-gray-400 text-xs mb-1">Votre nom / pseudo</label>
                <input
                  v-model="pseudo"
                  type="text"
                  placeholder="Nom affiché"
                  class="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition text-sm"
                />
              </div>
              <div>
                <label class="block text-gray-400 text-xs mb-1">Nom de votre espace *</label>
                <div class="relative">
                  <Store class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    v-model="spaceName"
                    type="text"
                    placeholder="Ex: Le Balafon Lounge..."
                    class="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition text-sm"
                  />
                </div>
              </div>
            </template>

            <p v-if="error" class="text-red-400 text-sm text-center bg-red-900/20 rounded-xl p-2">{{ error }}</p>

            <button
              @click="tab === 'login' ? handleLogin() : handleRegister()"
              :disabled="isSendingOtp"
              class="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Loader2 v-if="isSendingOtp" class="w-5 h-5 animate-spin" />
              <template v-else>
                <LogIn v-if="tab === 'login'" class="w-5 h-5" />
                <UserPlus v-else class="w-5 h-5" />
                {{ isSendingOtp ? 'Envoi du code...' : 'Recevoir le code' }}
              </template>
            </button>

            <router-link to="/" class="block text-center text-gray-500 text-sm hover:text-gray-300 transition">
              ← Retour à l'accueil
            </router-link>
          </div>
        </template>

        <!-- Step: OTP verification -->
        <template v-else>
          <div class="p-6 space-y-5">
            <div class="text-center">
              <ShieldCheck class="w-12 h-12 text-primary mx-auto mb-3" />
              <h3 class="text-lg font-bold text-white">Vérification</h3>
              <p class="text-gray-400 text-sm mt-1">
                Code envoyé sur WhatsApp au<br />
                <span class="font-semibold text-gray-200">+225 {{ phone }}</span>
              </p>
            </div>

            <div>
              <label class="block text-gray-400 text-xs mb-2 text-center">Code à 6 chiffres</label>
              <input
                v-model="otpCode"
                type="text"
                inputmode="numeric"
                maxlength="6"
                placeholder="_ _ _ _ _ _"
                @keyup.enter="handleVerifyOtp"
                class="w-full bg-gray-800 text-white border border-gray-700 focus:border-primary focus:outline-none rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] transition"
              />
            </div>

            <p v-if="error" class="text-red-400 text-sm text-center bg-red-900/20 rounded-xl p-2">{{ error }}</p>

            <button
              @click="handleVerifyOtp"
              :disabled="isLoading"
              class="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
              <span>{{ isLoading ? 'Vérification...' : 'Confirmer' }}</span>
            </button>

            <div class="text-center space-y-2">
              <button
                @click="handleResendOtp"
                :disabled="resendCooldown > 0 || isSendingOtp"
                class="text-sm text-primary disabled:text-gray-500 transition"
              >
                <Loader2 v-if="isSendingOtp" class="w-3 h-3 animate-spin inline mr-1" />
                {{ resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : 'Renvoyer le code' }}
              </button>
              <br />
              <button @click="backToForm" class="text-xs text-gray-500 hover:text-gray-300 transition">
                ← Modifier le numéro
              </button>
            </div>
          </div>
        </template>

      </div>
    </div>
  </Teleport>
</template>
