<script setup>
import { ref } from 'vue'
import { Store, LogIn, UserPlus, Loader2, ShieldCheck, Phone, Mail } from 'lucide-vue-next'
import { useUserStore } from '../stores/userStore'
import { findUserByPhone, findUserByEmail } from '../services/supabase'
import { sendOtp, sendOtpEmail, verifyOtp } from '../services/otpService'
import PhoneInput from './PhoneInput.vue'

const emit = defineEmits(['authenticated'])

const userStore = useUserStore()

const step = ref('form') // 'form' | 'otp'
const tab = ref('login')
const authMethod = ref('phone') // 'phone' | 'email'
const phone = ref('')
const email = ref('')
const pseudo = ref('')
const spaceName = ref('')
const otpCode = ref('')
const error = ref('')
const isSendingOtp = ref(false)
const isLoading = ref(false)
const resendCooldown = ref(0)
let cooldownTimer = null
let pendingAction = null

const startCooldown = () => {
  resendCooldown.value = 60
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

const sendOtpForAction = async (action) => {
  if (action.method === 'phone') await sendOtp(action.identifier)
  else await sendOtpEmail(action.identifier, action.user?.pseudo || action.user?.name || pseudo.value || 'Organisateur')
}

const handleLogin = async () => {
  error.value = ''
  isSendingOtp.value = true

  try {
    let existing, identifier
    if (authMethod.value === 'phone') {
      identifier = phone.value.trim()
      if (!identifier) { error.value = 'Numéro requis'; return }
      existing = await findUserByPhone(identifier)
    } else {
      identifier = email.value.trim().toLowerCase()
      if (!identifier || !identifier.includes('@')) { error.value = 'Email invalide'; return }
      existing = await findUserByEmail(identifier)
    }

    if (!existing) { error.value = 'Aucun compte pro trouvé. Créez un compte.'; return }
    if (existing.role !== 'organizer' && existing.role !== 'admin') {
      error.value = 'Compte non associé à un espace pro.'
      return
    }

    pendingAction = { type: 'login', method: authMethod.value, identifier, user: existing }
    await sendOtpForAction(pendingAction)
    step.value = 'otp'
    startCooldown()
  } catch (err) {
    error.value = `Echec envoi: ${err.message || 'inconnu'}`
  } finally {
    isSendingOtp.value = false
  }
}

const handleRegister = async () => {
  error.value = ''
  if (!spaceName.value.trim()) { error.value = 'Nom de l\'espace requis'; return }

  isSendingOtp.value = true
  try {
    let identifier, existing
    if (authMethod.value === 'phone') {
      identifier = phone.value.trim()
      if (!identifier) { error.value = 'Numéro requis'; return }
      existing = await findUserByPhone(identifier)
    } else {
      identifier = email.value.trim().toLowerCase()
      if (!identifier || !identifier.includes('@')) { error.value = 'Email invalide'; return }
      existing = await findUserByEmail(identifier)
    }

    // Refuser duplicate sauf si déjà organizer/admin (upgrade depuis consumer OK)
    if (existing && (existing.role === 'organizer' || existing.role === 'admin')) {
      error.value = 'Ce compte existe déjà. Connectez-vous.'
      return
    }

    pendingAction = { type: 'register', method: authMethod.value, identifier, existing }
    await sendOtpForAction(pendingAction)
    step.value = 'otp'
    startCooldown()
  } catch (err) {
    error.value = `Echec envoi: ${err.message || 'inconnu'}`
  } finally {
    isSendingOtp.value = false
  }
}

const handleVerifyOtp = async () => {
  error.value = ''
  if (!otpCode.value.trim()) { error.value = 'Entrez le code reçu'; return }

  const result = verifyOtp(pendingAction.identifier, otpCode.value)
  if (!result.valid) {
    error.value = result.reason === 'expired' ? 'Code expiré. Renvoyez un nouveau code.' : 'Code incorrect.'
    return
  }

  isLoading.value = true
  try {
    if (pendingAction.type === 'login') {
      const fresh = pendingAction.method === 'phone'
        ? await findUserByPhone(pendingAction.identifier)
        : await findUserByEmail(pendingAction.identifier)
      const userToLog = fresh || pendingAction.user
      if (userToLog.role !== 'organizer' && userToLog.role !== 'admin') {
        error.value = 'Rôle modifié — accès refusé.'
        return
      }
      userStore.user = userToLog
      userStore.saveSession?.()
      emit('authenticated', userToLog)
    } else {
      // Register : authenticate crée ou retrouve, puis becomeOrganizer
      const payload = pendingAction.method === 'phone'
        ? { phone: pendingAction.identifier, name: pseudo.value.trim() || 'Organisateur', pseudo: pseudo.value.trim() }
        : { phone: `email:${pendingAction.identifier}`, email: pendingAction.identifier, name: pseudo.value.trim() || 'Organisateur', pseudo: pseudo.value.trim() }
      // Email-only register : utiliser email comme identifier dans phone (workaround DB constraint)
      // ou créer user directement avec email seulement
      const user = await userStore.authenticate(payload)
      if (!user) { error.value = 'Erreur lors de la création du compte.'; return }

      const success = await userStore.becomeOrganizer({
        spaceName: spaceName.value.trim(),
        organizerName: pseudo.value.trim() || user.name
      })
      if (!success) { error.value = 'Erreur création espace.'; return }
      emit('authenticated', userStore.user)
    }
  } finally {
    isLoading.value = false
  }
}

const handleResendOtp = async () => {
  if (resendCooldown.value > 0 || !pendingAction) return
  isSendingOtp.value = true
  error.value = ''
  try {
    await sendOtpForAction(pendingAction)
    startCooldown()
    otpCode.value = ''
  } catch (err) {
    error.value = `Echec renvoi: ${err.message || 'inconnu'}`
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

const switchMethod = (m) => {
  authMethod.value = m
  error.value = ''
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-gray-900 rounded-2xl w-full max-w-sm border border-gray-800 overflow-hidden">

        <div class="p-6 text-center border-b border-gray-800">
          <Store class="w-10 h-10 text-primary mx-auto mb-2" />
          <h2 class="text-xl font-bold text-white">Espace Pro</h2>
          <p class="text-gray-400 text-sm mt-1">Gérez vos événements</p>
        </div>

        <template v-if="step === 'form'">
          <!-- Tabs login/register -->
          <div class="flex border-b border-gray-800">
            <button @click="tab = 'login'; error = ''" :class="tab === 'login' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'"
              class="flex-1 py-3 text-sm font-medium transition">
              <LogIn class="w-4 h-4 inline mr-1" /> Se connecter
            </button>
            <button @click="tab = 'register'; error = ''" :class="tab === 'register' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-white'"
              class="flex-1 py-3 text-sm font-medium transition">
              <UserPlus class="w-4 h-4 inline mr-1" /> Créer un compte
            </button>
          </div>

          <div class="p-6 space-y-4">
            <!-- Switch téléphone / email -->
            <div class="flex bg-gray-800 rounded-xl p-1">
              <button @click="switchMethod('phone')" :class="authMethod === 'phone' ? 'bg-primary text-black' : 'text-gray-400'"
                class="flex-1 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1">
                <Phone class="w-3.5 h-3.5" /> Téléphone
              </button>
              <button @click="switchMethod('email')" :class="authMethod === 'email' ? 'bg-primary text-black' : 'text-gray-400'"
                class="flex-1 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1">
                <Mail class="w-3.5 h-3.5" /> Email
              </button>
            </div>

            <div v-if="authMethod === 'phone'">
              <label class="block text-gray-400 text-xs mb-1">Numéro de téléphone</label>
              <PhoneInput v-model="phone" />
              <p class="text-[10px] text-gray-500 mt-1">Code de vérification sur WhatsApp.</p>
            </div>
            <div v-else>
              <label class="block text-gray-400 text-xs mb-1">Email</label>
              <div class="relative">
                <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input v-model="email" type="email" placeholder="email@exemple.com" autocomplete="email"
                  class="w-full bg-gray-800 text-white pl-9 pr-3 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition text-sm" />
              </div>
              <p class="text-[10px] text-gray-500 mt-1">Code de vérification par email.</p>
            </div>

            <template v-if="tab === 'register'">
              <div>
                <label class="block text-gray-400 text-xs mb-1">Votre nom / pseudo</label>
                <input v-model="pseudo" type="text" placeholder="Nom affiché"
                  class="w-full bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition text-sm" />
              </div>
              <div>
                <label class="block text-gray-400 text-xs mb-1">Nom de votre espace *</label>
                <div class="relative">
                  <Store class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input v-model="spaceName" type="text" placeholder="Ex: Le Balafon Lounge..."
                    class="w-full bg-gray-800 text-white pl-10 pr-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition text-sm" />
                </div>
              </div>
            </template>

            <p v-if="error" class="text-red-400 text-sm text-center bg-red-900/20 rounded-xl p-2">{{ error }}</p>

            <button @click="tab === 'login' ? handleLogin() : handleRegister()" :disabled="isSendingOtp"
              class="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-50">
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

        <template v-else>
          <div class="p-6 space-y-5">
            <div class="text-center">
              <ShieldCheck class="w-12 h-12 text-primary mx-auto mb-3" />
              <h3 class="text-lg font-bold text-white">Vérification</h3>
              <p class="text-gray-400 text-sm mt-1">
                Code envoyé via {{ pendingAction?.method === 'email' ? 'email' : 'WhatsApp' }}<br />
                <span class="font-semibold text-gray-200">{{ pendingAction?.identifier }}</span>
              </p>
            </div>

            <input v-model="otpCode" type="text" inputmode="numeric" maxlength="6" placeholder="_ _ _ _ _ _"
              @keyup.enter="handleVerifyOtp"
              class="w-full bg-gray-800 text-white border border-gray-700 focus:border-primary focus:outline-none rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] transition" />

            <p v-if="error" class="text-red-400 text-sm text-center bg-red-900/20 rounded-xl p-2">{{ error }}</p>

            <button @click="handleVerifyOtp" :disabled="isLoading"
              class="w-full bg-primary text-black font-bold py-3 rounded-xl hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-50">
              <Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
              <span>{{ isLoading ? 'Vérification...' : 'Confirmer' }}</span>
            </button>

            <div class="text-center space-y-2">
              <button @click="handleResendOtp" :disabled="resendCooldown > 0 || isSendingOtp" class="text-sm text-primary disabled:text-gray-500 transition">
                <Loader2 v-if="isSendingOtp" class="w-3 h-3 animate-spin inline mr-1" />
                {{ resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : 'Renvoyer le code' }}
              </button>
              <br />
              <button @click="backToForm" class="text-xs text-gray-500 hover:text-gray-300 transition">
                ← Modifier
              </button>
            </div>
          </div>
        </template>

      </div>
    </div>
  </Teleport>
</template>
