<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Lock, Phone, LogIn, Loader2, ShieldCheck } from 'lucide-vue-next'
import { supabase } from '../services/supabase'
import { sendOtp, verifyOtp } from '../services/otpService'

const router = useRouter()

const step = ref('phone') // 'phone' | 'otp'
const phone = ref('')
const otpCode = ref('')
const isLoading = ref(false)
const isSendingOtp = ref(false)
const loginError = ref('')
const resendCooldown = ref(0)
let cooldownTimer = null
let pendingUser = null

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

const handleRequestOtp = async () => {
  loginError.value = ''
  if (!phone.value.trim()) { loginError.value = 'Numéro requis'; return }

  const fullPhone = formatPhone(phone.value.trim())

  isSendingOtp.value = true
  try {
    // Verify admin exists with this phone
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', fullPhone)
      .maybeSingle()

    if (error || !data) {
      loginError.value = 'Numéro introuvable. Contactez le super-admin.'
      return
    }

    if (data.role !== 'admin' && data.role_v2 !== 'admin') {
      loginError.value = 'Accès refusé : compte non administrateur'
      return
    }

    pendingUser = data

    // Send OTP via WhatsApp
    await sendOtp(fullPhone)
    step.value = 'otp'
    startCooldown()
  } catch (err) {
    console.error('Admin OTP send failed:', err)
    loginError.value = `Echec envoi code: ${err.message || 'inconnu'}`
  } finally {
    isSendingOtp.value = false
  }
}

const handleVerifyOtp = async () => {
  loginError.value = ''
  if (!otpCode.value.trim()) { loginError.value = 'Entrez le code reçu'; return }

  const fullPhone = formatPhone(phone.value.trim())
  const result = verifyOtp(fullPhone, otpCode.value)

  if (!result.valid) {
    if (result.reason === 'expired') loginError.value = 'Code expiré. Renvoyez un nouveau code.'
    else loginError.value = 'Code incorrect.'
    return
  }

  isLoading.value = true
  try {
    // Re-fetch user pour vérifier rôle à jour (anti-stale)
    const { data: fresh } = await supabase
      .from('users')
      .select('*')
      .eq('phone', fullPhone)
      .maybeSingle()

    const finalUser = fresh || pendingUser
    if (finalUser.role !== 'admin' && finalUser.role_v2 !== 'admin') {
      loginError.value = 'Rôle modifié — accès refusé.'
      return
    }

    localStorage.setItem('pdvstar_admin_session', JSON.stringify({
      user: finalUser,
      expiry: Date.now() + 8 * 60 * 60 * 1000
    }))
    router.push('/admin/dashboard')
  } finally {
    isLoading.value = false
  }
}

const handleResendOtp = async () => {
  if (resendCooldown.value > 0) return
  const fullPhone = formatPhone(phone.value.trim())
  isSendingOtp.value = true
  loginError.value = ''
  try {
    await sendOtp(fullPhone)
    startCooldown()
    otpCode.value = ''
  } catch (err) {
    loginError.value = `Echec renvoi: ${err.message || 'inconnu'}`
  } finally {
    isSendingOtp.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-black flex flex-col items-center justify-center p-6">
    <!-- Logo/Title -->
    <div class="mb-8 text-center">
      <h1 class="text-4xl font-bold text-primary mb-2">Babi Vibes</h1>
      <p class="text-gray-400">Administration</p>
    </div>

    <!-- Login Card -->
    <div class="w-full max-w-sm bg-surface rounded-2xl p-6 shadow-xl">

      <!-- Step: phone -->
      <template v-if="step === 'phone'">
        <h2 class="text-xl font-bold text-white mb-6 text-center">Connexion Admin</h2>

        <form @submit.prevent="handleRequestOtp" class="space-y-4">
          <div>
            <label class="block text-gray-400 text-xs mb-1">Numéro de téléphone</label>
            <div class="flex">
              <span class="bg-gray-900 border border-r-0 border-gray-700 rounded-l-xl px-3 flex items-center text-gray-400 text-sm font-mono">+225</span>
              <input
                v-model="phone"
                type="tel"
                placeholder="0700000000"
                autocomplete="tel"
                class="flex-1 bg-gray-900 text-white px-3 py-3 rounded-r-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                required
              />
            </div>
            <p class="text-[10px] text-gray-500 mt-1">Un code OTP sera envoyé sur WhatsApp.</p>
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

      <!-- Step: OTP -->
      <template v-else>
        <div class="text-center mb-5">
          <ShieldCheck class="w-12 h-12 text-primary mx-auto mb-2" />
          <h3 class="text-lg font-bold text-white">Vérification Admin</h3>
          <p class="text-gray-400 text-xs mt-1">Code envoyé au<br /><span class="font-semibold text-gray-200">+225 {{ phone }}</span></p>
        </div>

        <div class="space-y-4">
          <div>
            <input
              v-model="otpCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="_ _ _ _ _ _"
              @keyup.enter="handleVerifyOtp"
              class="w-full bg-gray-900 text-white border border-gray-700 focus:border-primary focus:outline-none rounded-xl px-4 py-4 text-center text-2xl font-mono tracking-[0.5em] transition"
            />
          </div>

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
            <button @click="step = 'phone'; loginError = ''; otpCode = ''" class="text-xs text-gray-500 hover:text-gray-300 transition">
              ← Modifier le numéro
            </button>
          </div>
        </div>
      </template>

      <!-- Back Link -->
      <div class="mt-6 text-center">
        <router-link to="/" class="text-gray-400 text-sm hover:text-primary transition">
          ← Retour à l'accueil
        </router-link>
      </div>
    </div>
  </div>
</template>
