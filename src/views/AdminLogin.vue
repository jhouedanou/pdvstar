<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Lock, Phone, Mail, LogIn, Loader2, ShieldCheck } from 'lucide-vue-next'
import { supabase, findUserByEmail } from '../services/supabase'
import { sendOtp, sendOtpEmail, verifyOtp } from '../services/otpService'
import PhoneInput from '../components/PhoneInput.vue'
import { ADMIN_SESSION_DURATION_MS, SESSION_KEYS, writeSession } from '../utils/sessionStorage'

const router = useRouter()

const authMethod = ref('phone') // 'phone' | 'email'
const step = ref('input') // 'input' | 'otp'
const phone = ref('')
const email = ref('')
const otpCode = ref('')
const isLoading = ref(false)
const isSendingOtp = ref(false)
const loginError = ref('')
const resendCooldown = ref(0)
let cooldownTimer = null
let pendingUser = null
let pendingIdentifier = '' // phone OR email

const startCooldown = () => {
  resendCooldown.value = 60
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

const handleRequestOtp = async () => {
  loginError.value = ''
  isSendingOtp.value = true

  try {
    if (authMethod.value === 'phone') {
      const fullPhone = phone.value.trim()
      if (!fullPhone) { loginError.value = 'Numéro requis'; return }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', fullPhone)
        .maybeSingle()

      if (error || !data) { loginError.value = 'Numéro introuvable'; return }
      if (data.role !== 'admin' && data.role_v2 !== 'admin') { loginError.value = 'Accès refusé : compte non administrateur'; return }

      pendingUser = data
      pendingIdentifier = fullPhone
      await sendOtp(fullPhone)
    } else {
      const mail = email.value.trim().toLowerCase()
      if (!mail || !mail.includes('@')) { loginError.value = 'Email invalide'; return }

      const user = await findUserByEmail(mail)
      if (!user) { loginError.value = 'Email introuvable'; return }
      if (user.role !== 'admin' && user.role_v2 !== 'admin') { loginError.value = 'Accès refusé : compte non administrateur'; return }

      pendingUser = user
      pendingIdentifier = mail
      await sendOtpEmail(mail, user.pseudo || user.name)
    }
    step.value = 'otp'
    startCooldown()
  } catch (err) {
    console.error('Admin OTP send failed:', err)
    loginError.value = `Echec envoi: ${err.message || 'inconnu'}`
  } finally {
    isSendingOtp.value = false
  }
}

const handleVerifyOtp = async () => {
  loginError.value = ''
  if (!otpCode.value.trim()) { loginError.value = 'Entrez le code reçu'; return }

  const result = verifyOtp(pendingIdentifier, otpCode.value)
  if (!result.valid) {
    loginError.value = result.reason === 'expired' ? 'Code expiré. Renvoyez un nouveau code.' : 'Code incorrect.'
    return
  }

  isLoading.value = true
  try {
    // Re-fetch user (anti-stale role)
    let fresh
    if (authMethod.value === 'phone') {
      const { data } = await supabase.from('users').select('*').eq('phone', pendingIdentifier).maybeSingle()
      fresh = data
    } else {
      fresh = await findUserByEmail(pendingIdentifier)
    }

    const finalUser = fresh || pendingUser
    if (finalUser.role !== 'admin' && finalUser.role_v2 !== 'admin') {
      loginError.value = 'Rôle modifié — accès refusé.'
      return
    }

    writeSession(SESSION_KEYS.admin, finalUser, ADMIN_SESSION_DURATION_MS)
    router.push('/admin/dashboard')
  } finally {
    isLoading.value = false
  }
}

const handleResendOtp = async () => {
  if (resendCooldown.value > 0) return
  isSendingOtp.value = true
  loginError.value = ''
  try {
    if (authMethod.value === 'phone') {
      await sendOtp(pendingIdentifier)
    } else {
      await sendOtpEmail(pendingIdentifier, pendingUser?.pseudo || pendingUser?.name)
    }
    startCooldown()
    otpCode.value = ''
  } catch (err) {
    loginError.value = `Echec renvoi: ${err.message || 'inconnu'}`
  } finally {
    isSendingOtp.value = false
  }
}

const switchTab = (m) => {
  authMethod.value = m
  loginError.value = ''
}
</script>

<template>
  <div class="min-h-screen bg-black flex flex-col items-center justify-center p-6">
    <div class="mb-8 text-center">
      <h1 class="text-4xl font-bold text-primary mb-2">Babi Vibes</h1>
      <p class="text-gray-400">Administration</p>
    </div>

    <div class="w-full max-w-sm bg-surface rounded-2xl p-6 shadow-xl">

      <template v-if="step === 'input'">
        <h2 class="text-xl font-bold text-white mb-5 text-center">Connexion Admin</h2>

        <!-- Tabs phone/email -->
        <div class="flex bg-gray-900 rounded-xl p-1 mb-5">
          <button @click="switchTab('phone')" :class="authMethod === 'phone' ? 'bg-primary text-black' : 'text-gray-400'"
            class="flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5">
            <Phone class="w-4 h-4" /> Téléphone
          </button>
          <button @click="switchTab('email')" :class="authMethod === 'email' ? 'bg-primary text-black' : 'text-gray-400'"
            class="flex-1 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-1.5">
            <Mail class="w-4 h-4" /> Email
          </button>
        </div>

        <form @submit.prevent="handleRequestOtp" class="space-y-4">
          <div v-if="authMethod === 'phone'">
            <label class="block text-gray-400 text-xs mb-1">Numéro de téléphone</label>
            <PhoneInput v-model="phone" />
            <p class="text-[10px] text-gray-500 mt-1">Code OTP envoyé sur WhatsApp.</p>
          </div>
          <div v-else>
            <label class="block text-gray-400 text-xs mb-1">Email administrateur</label>
            <div class="relative">
              <Mail class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                v-model="email"
                type="email"
                placeholder="admin@example.com"
                autocomplete="email"
                class="w-full bg-gray-900 text-white pl-9 pr-3 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                required
              />
            </div>
            <p class="text-[10px] text-gray-500 mt-1">Code OTP envoyé par email.</p>
          </div>

          <p v-if="loginError" class="text-red-500 text-sm text-center">{{ loginError }}</p>

          <button
            type="submit"
            :disabled="isSendingOtp"
            class="w-full bg-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Loader2 v-if="isSendingOtp" class="w-5 h-5 animate-spin" />
            <template v-else>
              <LogIn class="w-5 h-5" />
              Recevoir le code
            </template>
          </button>
        </form>
      </template>

      <template v-else>
        <div class="text-center mb-5">
          <ShieldCheck class="w-12 h-12 text-primary mx-auto mb-2" />
          <h3 class="text-lg font-bold text-white">Vérification Admin</h3>
          <p class="text-gray-400 text-xs mt-1">
            Code envoyé via {{ authMethod === 'email' ? 'email' : 'WhatsApp' }}<br/>
            <span class="font-semibold text-gray-200">{{ pendingIdentifier }}</span>
          </p>
        </div>

        <div class="space-y-4">
          <input
            v-model="otpCode"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="_ _ _ _ _ _"
            @keyup.enter="handleVerifyOtp"
            class="w-full bg-gray-900 text-white border border-gray-700 focus:border-primary focus:outline-none rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] transition"
          />

          <p v-if="loginError" class="text-red-500 text-sm text-center">{{ loginError }}</p>

          <button
            @click="handleVerifyOtp"
            :disabled="isLoading"
            class="w-full bg-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition disabled:opacity-50"
          >
            <Loader2 v-if="isLoading" class="w-5 h-5 animate-spin" />
            <Lock v-else class="w-5 h-5" />
            {{ isLoading ? 'Vérification...' : 'Confirmer' }}
          </button>

          <div class="text-center space-y-2">
            <button @click="handleResendOtp" :disabled="resendCooldown > 0 || isSendingOtp" class="text-sm text-primary disabled:text-gray-500 transition">
              <Loader2 v-if="isSendingOtp" class="w-3 h-3 animate-spin inline mr-1" />
              {{ resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : 'Renvoyer le code' }}
            </button>
            <br />
            <button @click="step = 'input'; loginError = ''; otpCode = ''" class="text-xs text-gray-500 hover:text-gray-300 transition">
              ← Modifier
            </button>
          </div>
        </div>
      </template>

      <div class="mt-6 text-center">
        <router-link to="/" class="text-gray-400 text-sm hover:text-primary transition">
          ← Retour à l'accueil
        </router-link>
      </div>
    </div>
  </div>
</template>
