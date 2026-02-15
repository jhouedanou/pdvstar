<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/adminStore'
import { Lock, User, LogIn } from 'lucide-vue-next'

const router = useRouter()
const adminStore = useAdminStore()

const username = ref('')
const password = ref('')
const isLoading = ref(false)

const handleLogin = async () => {
    isLoading.value = true
    
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 300))
    
    const success = adminStore.login(username.value, password.value)
    
    isLoading.value = false
    
    if (success) {
        router.push('/admin/dashboard')
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
      <h2 class="text-xl font-bold text-white mb-6 text-center">Connexion Admin</h2>

      <form @submit.prevent="handleLogin" class="space-y-4">
        <!-- Username -->
        <div class="relative">
          <User class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            v-model="username"
            type="text"
            placeholder="Identifiant"
            class="w-full bg-gray-900 text-white pl-10 pr-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
            required
          />
        </div>

        <!-- Password -->
        <div class="relative">
          <Lock class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            v-model="password"
            type="password"
            placeholder="Mot de passe"
            class="w-full bg-gray-900 text-white pl-10 pr-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
            required
          />
        </div>

        <!-- Error Message -->
        <p v-if="adminStore.loginError" class="text-red-500 text-sm text-center">
          {{ adminStore.loginError }}
        </p>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="isLoading"
          class="w-full bg-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition disabled:opacity-50"
        >
          <template v-if="isLoading">
            <span class="animate-spin">⏳</span>
            Connexion...
          </template>
          <template v-else>
            <LogIn class="w-5 h-5" />
            Se connecter
          </template>
        </button>
      </form>

      <!-- Back Link -->
      <div class="mt-6 text-center">
        <router-link to="/" class="text-gray-400 text-sm hover:text-primary transition">
          ← Retour à l'accueil
        </router-link>
      </div>
    </div>
  </div>
</template>
