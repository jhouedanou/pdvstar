<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Loader2, LogOut, Save, UserCircle } from 'lucide-vue-next'
import { useUserStore } from '../stores/userStore'
import UserProfileModal from '../components/UserProfileModal.vue'

const router = useRouter()
const userStore = useUserStore()
const showProfileModal = ref(!userStore.user)
const isSaving = ref(false)
const success = ref('')

const form = ref({
    pseudo: userStore.user?.pseudo || userStore.user?.name || '',
    phone: userStore.user?.phone || '',
    email: userStore.user?.email || '',
    city: userStore.user?.city || '',
    district: userStore.user?.district || '',
    consentData: userStore.user?.consentData || false
})

const refreshForm = () => {
    form.value = {
        pseudo: userStore.user?.pseudo || userStore.user?.name || '',
        phone: userStore.user?.phone || '',
        email: userStore.user?.email || '',
        city: userStore.user?.city || '',
        district: userStore.user?.district || '',
        consentData: userStore.user?.consentData || false
    }
}

const handleProfileCreated = () => {
    showProfileModal.value = false
    refreshForm()
}

const saveProfile = async () => {
    isSaving.value = true
    success.value = ''
    await userStore.updateProfile({
        name: form.value.pseudo,
        pseudo: form.value.pseudo,
        phone: form.value.phone,
        email: form.value.email,
        city: form.value.city,
        district: form.value.district,
        consentData: form.value.consentData
    })
    success.value = 'Profil mis a jour.'
    isSaving.value = false
    setTimeout(() => {
        success.value = ''
    }, 2500)
}

const logout = () => {
    userStore.logout()
    showProfileModal.value = true
}
</script>

<template>
  <div class="min-h-screen bg-black text-white">
    <UserProfileModal v-if="showProfileModal" @profile-created="handleProfileCreated" />

    <header class="sticky top-0 z-30 bg-surface border-b border-gray-800 px-4 py-3">
      <div class="max-w-xl mx-auto flex items-center justify-between">
        <button @click="router.push('/')" class="text-gray-400 hover:text-white flex items-center gap-2">
          <ArrowLeft class="w-4 h-4" />
          Retour
        </button>
        <h1 class="font-bold text-primary">Profil</h1>
        <button v-if="userStore.user" @click="logout" class="text-red-400 hover:text-red-300">
          <LogOut class="w-4 h-4" />
        </button>
      </div>
    </header>

    <main class="max-w-xl mx-auto p-5">
      <div v-if="!userStore.user" class="text-center py-20">
        <UserCircle class="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p class="text-gray-400 mb-4">Aucun profil actif.</p>
        <button @click="showProfileModal = true" class="bg-primary text-black font-bold px-5 py-3 rounded-xl">
          Creer un profil
        </button>
      </div>

      <form v-else @submit.prevent="saveProfile" class="space-y-4">
        <div class="bg-surface border border-gray-800 rounded-2xl p-5">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
              <UserCircle class="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 class="text-lg font-bold">{{ userStore.user.pseudo || userStore.user.name }}</h2>
              <p class="text-sm text-gray-400">{{ userStore.user.role || 'consumer' }}</p>
            </div>
          </div>
        </div>

        <div class="grid gap-4">
          <input v-model="form.pseudo" type="text" placeholder="Pseudo" class="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          <input v-model="form.phone" type="tel" placeholder="Telephone" class="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          <input v-model="form.email" type="email" placeholder="Email" class="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          <div class="grid grid-cols-2 gap-3">
            <input v-model="form.city" type="text" placeholder="Ville" class="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
            <input v-model="form.district" type="text" placeholder="Quartier" class="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-primary" />
          </div>
          <label class="flex items-start gap-3 text-sm text-gray-400 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <input v-model="form.consentData" type="checkbox" class="mt-1 accent-primary" />
            <span>Autoriser la collecte first-party pour personnaliser les evenements et mesurer les participations.</span>
          </label>
        </div>

        <p v-if="success" class="text-green-400 text-sm">{{ success }}</p>
        <button type="submit" :disabled="isSaving" class="w-full bg-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
          <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
          <Save v-else class="w-4 h-4" />
          Enregistrer
        </button>
      </form>
    </main>
  </div>
</template>
