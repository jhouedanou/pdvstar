<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/adminStore'
import { useUserStore } from '../stores/userStore'
import { 
    ArrowLeft, Plus, Edit, Trash2, X, Check, Camera, Save, 
    ExternalLink, Eye, MousePointerClick, ToggleLeft, ToggleRight,
    LogOut, Megaphone, Store
} from 'lucide-vue-next'
import { fetchAds, createAd, updateAd, deleteAd } from '../services/supabase'

const router = useRouter()
const adminStore = useAdminStore()
const userStore = useUserStore()

// Détection du mode : admin classique ou organisateur
const isOrganizerMode = computed(() => !adminStore.isAuthenticated && userStore.isOrganizer)
const isAdmin = computed(() => adminStore.isAuthenticated)

const allAds = ref([])
const isLoading = ref(false)
const showModal = ref(false)
const editingAd = ref(null)
const deleteConfirmId = ref(null)

// Ads filtrées : admin voit tout, organisateur voit ses pubs
const ads = computed(() => {
    if (isAdmin.value) return allAds.value
    // Organisateur : filtrer par sponsor (nom de l'organisateur) ou created_by (user ID)
    const u = userStore.user
    if (!u) return []
    const names = [u.organizerName, u.spaceName, u.name].filter(Boolean).map(n => n.toLowerCase())
    return allAds.value.filter(a => {
        if (a.createdBy && u.id && a.createdBy === u.id) return true
        const sponsor = (a.sponsor || '').toLowerCase()
        return names.some(n => sponsor === n || sponsor.includes(n))
    })
})

const defaultForm = () => ({
    title: '',
    description: '',
    image: '',
    preview: '',
    link: '',
    sponsor: '',
    ctaText: 'En savoir plus',
    isActive: true,
    position: 0
})

const form = ref(defaultForm())

onMounted(async () => {
    await loadAds()
})

const loadAds = async () => {
    isLoading.value = true
    try {
        allAds.value = await fetchAds()
    } catch (e) {
        console.error('Erreur chargement ads:', e)
    } finally {
        isLoading.value = false
    }
}

const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
            form.value.preview = ev.target.result
            form.value.image = ev.target.result
        }
        reader.readAsDataURL(file)
    }
}

const openCreateModal = () => {
    form.value = defaultForm()
    // Auto-remplir le sponsor si organisateur connecté
    if (isOrganizerMode.value && userStore.user) {
        form.value.sponsor = userStore.user.organizerName || userStore.user.spaceName || userStore.user.name || ''
    }
    editingAd.value = null
    showModal.value = true
}

const openEditModal = (ad) => {
    editingAd.value = ad
    form.value = {
        title: ad.title,
        description: ad.description,
        image: ad.image,
        preview: ad.image,
        link: ad.link || '',
        sponsor: ad.sponsor,
        ctaText: ad.ctaText || 'En savoir plus',
        isActive: ad.isActive,
        position: ad.position || 0
    }
    showModal.value = true
}

const closeModal = () => {
    showModal.value = false
    editingAd.value = null
    form.value = defaultForm()
}

const handleSubmit = async () => {
    const adData = {
        title: form.value.title || 'Publicité',
        description: form.value.description || '',
        image: form.value.image || form.value.preview || '',
        link: form.value.link || '#',
        sponsor: form.value.sponsor || (userStore.user?.organizerName || userStore.user?.name || 'Sponsor'),
        ctaText: form.value.ctaText || 'En savoir plus',
        isActive: form.value.isActive,
        position: form.value.position || 0,
        createdBy: userStore.user?.id || null
    }

    if (editingAd.value) {
        const updated = await updateAd(editingAd.value.id, adData)
        if (updated) {
            const idx = allAds.value.findIndex(a => a.id === editingAd.value.id)
            if (idx !== -1) allAds.value[idx] = updated
        }
    } else {
        const created = await createAd(adData)
        if (created) {
            allAds.value.unshift(created)
        }
    }
    closeModal()
}

const handleDelete = async (id) => {
    const success = await deleteAd(id)
    if (success) {
        allAds.value = allAds.value.filter(a => a.id !== id)
    }
    deleteConfirmId.value = null
}

const toggleActive = async (ad) => {
    const updated = await updateAd(ad.id, { isActive: !ad.isActive })
    if (updated) {
        const idx = allAds.value.findIndex(a => a.id === ad.id)
        if (idx !== -1) allAds.value[idx] = updated
    }
}

const totalClicks = computed(() => ads.value.reduce((s, a) => s + (a.clickCount || 0), 0))
const totalViews = computed(() => ads.value.reduce((s, a) => s + (a.viewCount || 0), 0))
const activeAds = computed(() => ads.value.filter(a => a.isActive).length)
</script>

<template>
  <div class="min-h-screen bg-black">
    <!-- Header -->
    <header class="bg-surface border-b border-gray-800 px-4 py-3 sticky top-0 z-40">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center gap-3">
          <Megaphone class="w-5 h-5 text-yellow-400" />
          <h1 class="text-xl font-bold text-yellow-400">
            {{ isOrganizerMode ? 'Mes Publicités' : 'Gestion des Publicités' }}
          </h1>
          <p v-if="isOrganizerMode" class="text-xs text-gray-400 mt-0.5">
            <Store class="w-3 h-3 inline" /> {{ userStore.user?.spaceName || userStore.user?.organizerName }}
          </p>
        </div>
        <div class="flex items-center gap-4">
          <router-link to="/admin/dashboard" class="text-gray-400 text-sm hover:text-white transition flex items-center gap-1">
            <ArrowLeft class="w-4 h-4" />
            {{ isOrganizerMode ? 'Mon Espace' : 'Dashboard Admin' }}
          </router-link>
        </div>
      </div>
    </header>

    <main class="max-w-6xl mx-auto p-4">
      <!-- Stats Cards -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-surface border border-gray-800 rounded-xl p-4 text-center">
          <p class="text-2xl font-bold text-yellow-400">{{ ads.length }}</p>
          <p class="text-gray-500 text-xs mt-1">Total pubs</p>
        </div>
        <div class="bg-surface border border-gray-800 rounded-xl p-4 text-center">
          <p class="text-2xl font-bold text-green-400">{{ activeAds }}</p>
          <p class="text-gray-500 text-xs mt-1">Actives</p>
        </div>
        <div class="bg-surface border border-gray-800 rounded-xl p-4 text-center">
          <p class="text-2xl font-bold text-primary">{{ totalClicks }}</p>
          <p class="text-gray-500 text-xs mt-1">Clics total</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-white">Annonceurs / Sponsors</h2>
        <button 
          @click="openCreateModal"
          class="bg-yellow-400 text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-yellow-500 transition"
        >
          <Plus class="w-5 h-5" />
          Nouvelle Publicité
        </button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="text-center py-16">
        <p class="text-gray-400 animate-pulse">Chargement...</p>
      </div>

      <!-- Ads Grid -->
      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div 
          v-for="ad in ads" 
          :key="ad.id"
          class="bg-surface rounded-xl overflow-hidden border transition"
          :class="ad.isActive ? 'border-gray-800 hover:border-yellow-400/50' : 'border-gray-800 opacity-60'"
        >
          <div class="relative">
            <img :src="ad.image" :alt="ad.title" class="w-full h-36 object-cover" />
            <div class="absolute top-2 left-2">
              <span 
                class="px-2 py-1 rounded-full text-[10px] font-bold"
                :class="ad.isActive ? 'bg-green-500 text-white' : 'bg-gray-600 text-gray-300'"
              >
                {{ ad.isActive ? '● ACTIVE' : '○ INACTIVE' }}
              </span>
            </div>
            <div class="absolute top-2 right-2 flex gap-1.5">
              <span class="bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                <Eye class="w-3 h-3" /> {{ ad.viewCount || 0 }}
              </span>
              <span class="bg-black/60 backdrop-blur-sm text-yellow-400 text-[10px] px-2 py-1 rounded-full flex items-center gap-1">
                <MousePointerClick class="w-3 h-3" /> {{ ad.clickCount || 0 }}
              </span>
            </div>
          </div>

          <div class="p-4">
            <div class="flex items-center gap-2 mb-2">
              <img :src="`https://api.dicebear.com/7.x/initials/svg?seed=${ad.sponsor}`" class="w-8 h-8 rounded-full border border-yellow-400/50" />
              <div>
                <h3 class="font-bold text-white text-sm">{{ ad.title }}</h3>
                <p class="text-yellow-400 text-xs">{{ ad.sponsor }}</p>
              </div>
            </div>
            <p class="text-gray-400 text-xs line-clamp-2 mb-2">{{ ad.description }}</p>
            
            <div v-if="ad.link && ad.link !== '#'" class="mb-3">
              <a :href="ad.link" target="_blank" class="text-primary text-xs flex items-center gap-1 hover:underline truncate">
                <ExternalLink class="w-3 h-3" /> {{ ad.link }}
              </a>
            </div>

            <div class="flex items-center gap-1.5 mb-3">
              <span class="bg-yellow-400/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full">
                CTA: {{ ad.ctaText || 'En savoir plus' }}
              </span>
              <span class="bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">
                Pos: {{ ad.position || 0 }}
              </span>
            </div>

            <!-- Actions -->
            <div class="flex gap-2">
              <button @click="toggleActive(ad)" class="flex-1 py-2 rounded-lg flex items-center justify-center gap-1 text-sm font-medium transition"
                :class="ad.isActive ? 'bg-gray-800 text-green-400 hover:bg-gray-700' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'">
                <ToggleRight v-if="ad.isActive" class="w-4 h-4" />
                <ToggleLeft v-else class="w-4 h-4" />
                {{ ad.isActive ? 'Désactiver' : 'Activer' }}
              </button>
              <button @click="openEditModal(ad)" class="bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition">
                <Edit class="w-4 h-4" />
              </button>
              <button 
                v-if="deleteConfirmId !== ad.id"
                @click="deleteConfirmId = ad.id" 
                class="bg-red-500/20 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/30 transition"
              >
                <Trash2 class="w-4 h-4" />
              </button>
              <div v-else class="flex gap-1">
                <button @click="handleDelete(ad.id)" class="bg-red-500 text-white px-3 py-2 rounded-lg">
                  <Check class="w-4 h-4" />
                </button>
                <button @click="deleteConfirmId = null" class="bg-gray-700 text-white px-3 py-2 rounded-lg">
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!isLoading && ads.length === 0" class="text-center py-16">
        <Megaphone class="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p class="text-gray-400 text-lg mb-4">Aucune publicité</p>
        <button @click="openCreateModal" class="bg-yellow-400 text-black font-bold px-6 py-3 rounded-xl inline-flex items-center gap-2 hover:bg-yellow-500 transition">
          <Plus class="w-5 h-5" />
          Créer la première publicité
        </button>
      </div>
    </main>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div 
        v-if="showModal" 
        class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        @click.self="closeModal"
      >
        <div class="bg-surface rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="p-4 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-surface z-10">
            <h3 class="text-xl font-bold text-white">
              {{ editingAd ? 'Modifier la publicité' : 'Nouvelle Publicité' }}
            </h3>
            <button @click="closeModal" class="text-gray-400 hover:text-white transition">
              <X class="w-6 h-6" />
            </button>
          </div>

          <form @submit.prevent="handleSubmit" class="p-4 space-y-4">
            <!-- Image -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Image de la publicité</label>
              <label class="block w-full h-36 bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-yellow-400 transition overflow-hidden">
                <div v-if="form.preview" class="w-full h-full">
                  <img :src="form.preview" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-full h-full flex flex-col items-center justify-center">
                  <Camera class="w-8 h-8 text-gray-600 mb-2" />
                  <span class="text-gray-500 text-sm">Cliquer pour ajouter une image</span>
                </div>
                <input type="file" accept="image/*" @change="handleImageChange" class="hidden" />
              </label>
              <!-- Ou URL -->
              <input 
                v-model="form.image" 
                type="url" 
                placeholder="Ou coller une URL d'image..."
                class="w-full bg-gray-900 text-white px-4 py-2 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none transition mt-2 text-sm"
              />
            </div>

            <!-- Sponsor -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Annonceur / Sponsor *</label>
              <input 
                v-model="form.sponsor" 
                type="text" 
                placeholder="Ex: Orange CI, Heineken, Uber Eats..."
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none transition"
                required
              />
            </div>

            <!-- Title -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Titre de la pub *</label>
              <input 
                v-model="form.title" 
                type="text" 
                placeholder="Ex: Orange Money — Paiements instantanés"
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none transition"
                required
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Description</label>
              <textarea 
                v-model="form.description" 
                rows="2"
                placeholder="Description courte de la publicité..."
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none transition resize-none"
              ></textarea>
            </div>

            <!-- Link -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">🔗 Lien de destination (URL)</label>
              <input 
                v-model="form.link" 
                type="url" 
                placeholder="Ex: https://www.orangemoney.ci"
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none transition"
              />
            </div>

            <!-- CTA Text -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Texte du bouton CTA</label>
              <input 
                v-model="form.ctaText" 
                type="text" 
                placeholder="Ex: En savoir plus, Commander, Découvrir..."
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none transition"
              />
            </div>

            <!-- Position & Active -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-gray-400 text-sm mb-2">Position (ordre d'affichage)</label>
                <input 
                  v-model.number="form.position" 
                  type="number" 
                  min="0"
                  class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none transition"
                />
              </div>
              <div class="flex items-end pb-1">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input v-model="form.isActive" type="checkbox" class="w-5 h-5 rounded bg-gray-900 border-gray-700 text-yellow-400 focus:ring-yellow-400" />
                  <span class="text-white font-medium">Active</span>
                </label>
              </div>
            </div>

            <!-- Submit -->
            <button 
              type="submit"
              class="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-yellow-500 transition"
            >
              <Save class="w-5 h-5" />
              {{ editingAd ? 'Enregistrer' : 'Créer la publicité' }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
