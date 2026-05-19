<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '../stores/adminStore'
import { useUserStore } from '../stores/userStore'
import { processImage, processAndUpload } from '../utils/imageUpload'
import {
    ArrowLeft, Plus, Edit, Trash2, X, Check, Camera, Save,
    ExternalLink, Eye, MousePointerClick, ToggleLeft, ToggleRight,
    Megaphone, Store, ChevronUp, ChevronDown, ShieldCheck, ShieldX, Clock, AlertTriangle
} from 'lucide-vue-next'
import { fetchAds, createAd, updateAd, deleteAd, supabase } from '../services/supabase'
import { fetchAdsByOrganizer, fetchAllAds, approveAdvert, rejectAdvert, archiveAdvert } from '../services/adsService'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()
const insideAdminLayout = computed(() => route.path.startsWith('/admin'))
const userStore = useUserStore()

// Détection du mode : admin classique ou organisateur
const isOrganizerMode = computed(() => !adminStore.isAuthenticated && userStore.isOrganizer)
const isAdmin = computed(() => adminStore.isAuthenticated)

const allAds = ref([])
const isLoading = ref(false)
const showModal = ref(false)
const editingAd = ref(null)
const deleteConfirmId = ref(null)
const imageError = ref('')

// Filtre statut (admin uniquement)
const statusFilter = ref('all')
// Rejet : modale de motif
const rejectingAdId = ref(null)
const rejectionReason = ref('')

// Statuts disponibles
const AD_STATUSES = [
    { key: 'all', label: 'Toutes' },
    { key: 'pending', label: 'En attente' },
    { key: 'approved', label: 'Approuvées' },
    { key: 'rejected', label: 'Rejetées' },
    { key: 'archived', label: 'Archivées' },
]

// Ads filtrées : admin voit tout (filtré par status), organisateur voit ses pubs
const ads = computed(() => {
    let list = allAds.value
    if (!isAdmin.value) return list // déjà filtré par fetchAdsByOrganizer
    if (statusFilter.value !== 'all') list = list.filter(a => a.status === statusFilter.value)
    return list
})

const statusCountsAds = computed(() => ({
    all: allAds.value.length,
    pending: allAds.value.filter(a => a.status === 'pending').length,
    approved: allAds.value.filter(a => a.status === 'approved').length,
    rejected: allAds.value.filter(a => a.status === 'rejected').length,
    archived: allAds.value.filter(a => a.status === 'archived').length,
}))

const defaultForm = () => ({
    title: '',
    description: '',
    image: '',
    preview: '',
    link: '',
    sponsor: '',
    ctaText: 'En savoir plus',
    isActive: true,
    position: 0,
    format: 'banner',
    targetQuartier: '',
    targetPdv: '',
    videoUrl: ''
})

const AD_FORMATS = [
    { value: 'banner',     label: 'Banniere' },
    { value: 'fullscreen', label: 'Plein ecran' },
    { value: 'video',      label: 'Video' },
    { value: 'story',      label: 'Story sponso' }
]

const form = ref(defaultForm())

onMounted(async () => {
    await loadAds()
    await loadFilters()
})

const loadAds = async () => {
    isLoading.value = true
    try {
        if (isAdmin.value) {
            // Admin : toutes les pubs via fetchAllAds (avec status)
            allAds.value = await fetchAllAds()
        } else if (isOrganizerMode.value && userStore.user?.id) {
            // Organisateur : uniquement ses pubs
            allAds.value = await fetchAdsByOrganizer(userStore.user.id)
        } else {
            // Fallback
            allAds.value = await fetchAds()
        }
    } catch (e) {
        console.error('Erreur chargement ads:', e)
    } finally {
        isLoading.value = false
    }
}

const handleImageChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    imageError.value = ''
    const compressed = await processImage(file)
    if (!compressed.success) {
        imageError.value = compressed.error
        return
    }
    form.value.preview = compressed.data
    const uploaded = await processAndUpload(file, 'ads')
    if (uploaded.success) {
        form.value.image = uploaded.data
    } else {
        form.value.image = compressed.data
        imageError.value = uploaded.error || 'Upload bucket KO, image en base64'
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
        position: ad.position || 0,
        format: ad.format || 'banner',
        targetQuartier: ad.targetQuartier || '',
        targetPdv: ad.targetPdv || '',
        videoUrl: ad.videoUrl || ''
    }
    showModal.value = true
}

const closeModal = () => {
    showModal.value = false
    editingAd.value = null
    form.value = defaultForm()
}

const handleSubmit = async () => {
    // Statut : pending pour organisateur, approved pour admin
    const newStatus = isAdmin.value ? 'approved' : 'pending'
    const adData = {
        title: form.value.title || 'Publicité',
        description: form.value.description || '',
        image: form.value.image || form.value.preview || '',
        link: form.value.link || '#',
        sponsor: form.value.sponsor || (userStore.user?.organizerName || userStore.user?.name || 'Sponsor'),
        ctaText: form.value.ctaText || 'En savoir plus',
        isActive: isAdmin.value ? form.value.isActive : false, // organisateur: inactif jusqu'à approbation
        position: form.value.position || 0,
        format: form.value.format || 'banner',
        targetQuartier: form.value.targetQuartier || null,
        targetPdv: form.value.targetPdv || null,
        videoUrl: form.value.videoUrl || null,
        createdBy: userStore.user?.id || null,
        advertiserId: userStore.user?.id || null,
        status: editingAd.value ? editingAd.value.status : newStatus
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
const pendingCount = computed(() => allAds.value.filter(a => a.status === 'pending').length)

/** Admin : approuver une pub */
const handleApprove = async (ad) => {
    const updated = await approveAdvert(ad.id, adminStore.adminUser?.id || 'admin')
    if (updated) {
        const idx = allAds.value.findIndex(a => a.id === ad.id)
        if (idx !== -1) allAds.value[idx] = updated
    }
}

/** Admin : ouvrir la modale de rejet */
const openRejectModal = (ad) => {
    rejectingAdId.value = ad.id
    rejectionReason.value = ''
}

/** Admin : confirmer le rejet avec motif */
const confirmReject = async () => {
    if (!rejectionReason.value.trim()) return
    const updated = await rejectAdvert(rejectingAdId.value, rejectionReason.value)
    if (updated) {
        const idx = allAds.value.findIndex(a => a.id === rejectingAdId.value)
        if (idx !== -1) allAds.value[idx] = updated
    }
    rejectingAdId.value = null
    rejectionReason.value = ''
}

/** Couleur et libellé du badge de statut */
function statusBadge(status) {
    switch (status) {
        case 'approved': return { cls: 'bg-green-500/20 text-green-400 border border-green-500/30', label: 'Approuvée' }
        case 'pending': return { cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30', label: 'En attente' }
        case 'rejected': return { cls: 'bg-red-500/20 text-red-400 border border-red-500/30', label: 'Rejetée' }
        case 'archived': return { cls: 'bg-gray-500/20 text-gray-400 border border-gray-500/30', label: 'Archivée' }
        default: return { cls: 'bg-gray-700 text-gray-300', label: status || '-' }
    }
}

// Quartiers et PDV depuis la base
const quartiersDB = ref([])
const pdvsDB = ref([])

const loadFilters = async () => {
    const { data: qData } = await supabase
        .from('events')
        .select('quartier')
        .not('quartier', 'is', null)
        .neq('quartier', '')
    if (qData) {
        const unique = [...new Set(qData.map(r => r.quartier))].sort()
        quartiersDB.value = unique
    }
    const { data: pData } = await supabase
        .from('ads')
        .select('target_pdv')
        .not('target_pdv', 'is', null)
        .neq('target_pdv', '')
    if (pData) {
        const unique = [...new Set(pData.map(r => r.target_pdv))].sort()
        pdvsDB.value = unique
    }
}

// Reorder position
const moveAd = async (index, dir) => {
    const sorted = [...allAds.value].sort((a, b) => (a.position || 0) - (b.position || 0))
    const targetIndex = index + dir
    if (targetIndex < 0 || targetIndex >= sorted.length) return
    const a = sorted[index]
    const b = sorted[targetIndex]
    const posA = a.position ?? index
    const posB = b.position ?? targetIndex
    await Promise.all([
        updateAd(a.id, { position: posB }),
        updateAd(b.id, { position: posA })
    ])
    a.position = posB
    b.position = posA
    allAds.value = [...allAds.value]
}
</script>

<template>
  <div :class="insideAdminLayout ? 'text-white' : 'min-h-screen bg-black text-white'">
    <!-- Header standalone (hors AdminLayout) -->
    <header v-if="!insideAdminLayout" class="bg-surface border-b border-gray-800 px-4 py-3 sticky top-0 z-40">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center gap-2">
          <Megaphone class="w-5 h-5 text-yellow-400" />
          <h1 class="text-lg font-bold text-yellow-400">
            {{ isOrganizerMode ? 'Mes Publicités' : 'Gestion des Publicités' }}
          </h1>
        </div>
        <router-link :to="isOrganizerMode ? '/organizer' : '/admin/dashboard'" class="text-gray-400 text-sm hover:text-white flex items-center gap-1">
          <ArrowLeft class="w-4 h-4" /> Retour
        </router-link>
      </div>
    </header>

    <!-- Titre inline (dans AdminLayout) -->
    <div v-else class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-100">Publicités</h1>
        <p class="text-slate-400 text-sm">{{ ads.length }} pub(s) — {{ activeAds }} actives</p>
      </div>
      <button @click="openCreateModal" class="bg-yellow-400 text-black font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-yellow-300 transition">
        <Plus class="w-4 h-4" /> Nouvelle pub
      </button>
    </div>

    <div :class="insideAdminLayout ? '' : 'max-w-6xl mx-auto p-4'">
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
          <p class="text-2xl font-bold text-yellow-400" :class="pendingCount > 0 ? 'animate-pulse' : ''">{{ isAdmin ? pendingCount : totalClicks }}</p>
          <p class="text-gray-500 text-xs mt-1">{{ isAdmin ? 'En attente' : 'Clics total' }}</p>
        </div>
      </div>

      <!-- Info organisateur : pub en attente de validation -->
      <div v-if="isOrganizerMode" class="mb-4 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-3">
        <Clock class="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p class="text-yellow-300 font-medium text-sm">Validation requise</p>
          <p class="text-yellow-400/70 text-xs">Toute publicité créée ici sera soumise à l'admin pour approbation avant diffusion.</p>
        </div>
      </div>

      <!-- Filtre statut (admin uniquement) -->
      <div v-if="isAdmin" class="flex gap-2 flex-wrap mb-6">
        <button
          v-for="s in AD_STATUSES" :key="s.key"
          @click="statusFilter = s.key"
          :class="['px-3 py-1.5 rounded-full text-xs font-medium transition border',
            statusFilter === s.key
              ? 'bg-yellow-400 text-black border-yellow-400'
              : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-yellow-400/50']"
        >
          {{ s.label }}
          <span class="ml-1 opacity-70">{{ statusCountsAds[s.key] }}</span>
        </button>
      </div>

      <!-- Actions -->
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-white">
          {{ isOrganizerMode ? 'Mes publicités' : 'Annonceurs / Sponsors' }}
        </h2>
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

            <!-- Badge statut + motif rejet -->
            <div class="flex items-center gap-2 mb-3 flex-wrap">
              <span :class="['text-[10px] font-bold px-2 py-0.5 rounded-full', statusBadge(ad.status).cls]">
                {{ statusBadge(ad.status).label }}
              </span>
              <span class="bg-yellow-400/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full">
                CTA: {{ ad.ctaText || 'En savoir plus' }}
              </span>
              <span v-if="isAdmin" class="bg-gray-700 text-white text-xs font-bold px-3 py-1 rounded-full border border-gray-600">
                #{{ ad.position || 0 }}
              </span>
            </div>

            <!-- Motif rejet (organisateur) -->
            <div v-if="ad.status === 'rejected' && ad.rejectionReason" class="mb-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
              <p class="text-red-400 text-xs"><span class="font-bold">Motif :</span> {{ ad.rejectionReason }}</p>
            </div>

            <!-- Boutons approbation / rejet admin (uniquement en attente) -->
            <div v-if="isAdmin && ad.status === 'pending'" class="flex gap-2 mb-3">
              <button @click="handleApprove(ad)"
                class="flex-1 py-2 rounded-lg bg-green-500/20 text-green-400 text-sm font-bold flex items-center justify-center gap-1 hover:bg-green-500/30 transition border border-green-500/30">
                <ShieldCheck class="w-4 h-4" /> Approuver
              </button>
              <button @click="openRejectModal(ad)"
                class="flex-1 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm font-bold flex items-center justify-center gap-1 hover:bg-red-500/30 transition border border-red-500/30">
                <ShieldX class="w-4 h-4" /> Rejeter
              </button>
            </div>

            <!-- Actions classiques -->
            <div class="flex gap-1.5">
              <div v-if="isAdmin" class="flex flex-col gap-0.5">
                <button @click="moveAd(ads.indexOf(ad), -1)" class="p-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition">
                  <ChevronUp class="w-3 h-3" />
                </button>
                <button @click="moveAd(ads.indexOf(ad), 1)" class="p-1 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition">
                  <ChevronDown class="w-3 h-3" />
                </button>
              </div>
              <button v-if="isAdmin || ad.status === 'approved'" @click="toggleActive(ad)" class="flex-1 py-2 rounded-lg flex items-center justify-center gap-1 text-sm font-medium transition"
                :class="ad.isActive ? 'bg-gray-800 text-green-400 hover:bg-gray-700' : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'">
                <ToggleRight v-if="ad.isActive" class="w-4 h-4" />
                <ToggleLeft v-else class="w-4 h-4" />
                {{ ad.isActive ? 'Active' : 'Inactive' }}
              </button>
              <button @click="openEditModal(ad)" class="bg-gray-800 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition">
                <Edit class="w-4 h-4" />
              </button>
              <button v-if="deleteConfirmId !== ad.id" @click="deleteConfirmId = ad.id"
                class="bg-red-500/20 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/30 transition">
                <Trash2 class="w-4 h-4" />
              </button>
              <div v-else class="flex gap-1">
                <button @click="handleDelete(ad.id)" class="bg-red-500 text-white px-3 py-2 rounded-lg"><Check class="w-4 h-4" /></button>
                <button @click="deleteConfirmId = null" class="bg-gray-700 text-white px-3 py-2 rounded-lg"><X class="w-4 h-4" /></button>
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
    </div>

    <!-- Modale de rejet avec motif (admin) -->
    <Teleport to="body">
      <div v-if="rejectingAdId" class="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" @click.self="rejectingAdId = null">
        <div class="bg-surface rounded-2xl w-full max-w-md p-6">
          <div class="flex items-center gap-3 mb-4">
            <ShieldX class="w-6 h-6 text-red-400" />
            <h3 class="text-lg font-bold text-white">Rejeter la publicité</h3>
          </div>
          <p class="text-gray-400 text-sm mb-4">Indiquez le motif de rejet visible par l'organisateur :</p>
          <textarea
            v-model="rejectionReason"
            rows="3"
            placeholder="Ex: Image non conforme, contenu inapproprié, budget insuffisant..."
            class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-red-400 focus:outline-none transition resize-none text-sm mb-4"
          ></textarea>
          <div class="flex gap-3">
            <button @click="rejectingAdId = null" class="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold hover:bg-gray-700 transition">
              Annuler
            </button>
            <button @click="confirmReject" :disabled="!rejectionReason.trim()"
              class="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
              Confirmer le rejet
            </button>
          </div>
        </div>
      </div>
    </Teleport>

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
              <p v-if="imageError" class="text-red-500 text-sm mt-2 font-medium">{{ imageError }}</p>
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
              <label class="block text-gray-400 text-sm mb-2">Lien de destination (URL)</label>
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

            <!-- Phase 3: Format publicitaire -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Format</label>
              <select v-model="form.format" class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none">
                <option v-for="f in AD_FORMATS" :key="f.value" :value="f.value">{{ f.label }}</option>
              </select>
            </div>

            <!-- Phase 3: URL vidéo si format video -->
            <div v-if="form.format === 'video' || form.format === 'story'">
              <label class="block text-gray-400 text-sm mb-2">URL vidéo (MP4/YouTube)</label>
              <input v-model="form.videoUrl" type="url" placeholder="https://..."
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none" />
            </div>

            <!-- Phase 3: Ciblage -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-gray-400 text-sm mb-2">Quartier cible</label>
                <select v-model="form.targetQuartier"
                  class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none">
                  <option value="">Tous quartiers</option>
                  <option v-for="q in quartiersDB" :key="q" :value="q">{{ q }}</option>
                </select>
                <input v-if="!quartiersDB.length" v-model="form.targetQuartier" type="text"
                  placeholder="Cocody, Plateau…"
                  class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none mt-1 text-sm" />
              </div>
              <div>
                <label class="block text-gray-400 text-sm mb-2">PDV cible</label>
                <select v-model="form.targetPdv"
                  class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none">
                  <option value="">Tous PDV</option>
                  <option v-for="p in pdvsDB" :key="p" :value="p">{{ p }}</option>
                </select>
                <input v-if="!pdvsDB.length" v-model="form.targetPdv" type="text"
                  placeholder="Code PDV ou lieu"
                  class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-yellow-400 focus:outline-none mt-1 text-sm" />
              </div>
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

