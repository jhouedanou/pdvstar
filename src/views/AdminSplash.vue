<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/adminStore'
import { supabase } from '../services/supabase'
import { ArrowLeft, Plus, Trash2, GripVertical, Eye, Upload, Save } from 'lucide-vue-next'

const router = useRouter()
const adminStore = useAdminStore()

const DEFAULT_SLIDES = [
    '/splashscreen/01.png',
    '/splashscreen/02.png',
    '/splashscreen/03.png',
    '/splashscreen/04.png'
]

const slides = ref([])
const previewSlide = ref(0)
const newUrl = ref('')
const uploading = ref(false)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const fileInput = ref(null)

onMounted(() => {
    const stored = localStorage.getItem('pdvstar_splash_images')
    try {
        const arr = stored ? JSON.parse(stored) : null
        slides.value = Array.isArray(arr) && arr.length ? [...arr] : [...DEFAULT_SLIDES]
    } catch {
        slides.value = [...DEFAULT_SLIDES]
    }
})

let previewTimer = null
const startPreview = () => {
    clearInterval(previewTimer)
    previewTimer = setInterval(() => {
        previewSlide.value = (previewSlide.value + 1) % slides.value.length
    }, 2000)
}
const stopPreview = () => clearInterval(previewTimer)

const addUrl = () => {
    const url = newUrl.value.trim()
    if (!url) return
    slides.value.push(url)
    newUrl.value = ''
}

const removeSlide = (i) => {
    slides.value.splice(i, 1)
    if (previewSlide.value >= slides.value.length) previewSlide.value = 0
}

const moveUp = (i) => {
    if (i === 0) return
    const arr = slides.value
    ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
    slides.value = [...arr]
}

const moveDown = (i) => {
    if (i === slides.value.length - 1) return
    const arr = slides.value
    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
    slides.value = [...arr]
}

const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    error.value = ''
    uploading.value = true
    try {
        const ext = file.name.split('.').pop()
        const path = `splash/${Date.now()}.${ext}`
        const { data, error: upErr } = await supabase.storage
            .from('media')
            .upload(path, file, { upsert: true })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        slides.value.push(publicUrl)
    } catch (e) {
        error.value = `Erreur upload: ${e.message}. Vérifier que le bucket "media" existe dans Supabase Storage.`
    }
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
}

const save = () => {
    saving.value = true
    localStorage.setItem('pdvstar_splash_images', JSON.stringify(slides.value))
    setTimeout(() => {
        saving.value = false
        saved.value = true
        setTimeout(() => saved.value = false, 2000)
    }, 400)
}

const resetToDefault = () => {
    slides.value = [...DEFAULT_SLIDES]
}
</script>

<template>
  <div class="text-white">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-100">Splash Screen</h1>
        <p class="text-slate-400 text-sm">Gérer le diaporama d'accueil</p>
      </div>
      <button
        @click="save"
        :disabled="saving"
        class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition"
      >
        <Save class="w-4 h-4" />
        {{ saved ? 'Sauvegardé !' : saving ? '...' : 'Sauvegarder' }}
      </button>
    </div>

    <div class="max-w-xl space-y-6">

      <!-- Apercu mini -->
      <div
        class="relative rounded-2xl overflow-hidden aspect-[9/16] max-h-64 bg-black cursor-pointer"
        @mouseenter="startPreview" @mouseleave="stopPreview"
      >
        <div
          v-for="(img, i) in slides" :key="img + i"
          class="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          :class="previewSlide === i ? 'opacity-100' : 'opacity-0'"
          :style="{ backgroundImage: `url(${img})` }"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div class="absolute bottom-3 inset-x-0 flex justify-center gap-1">
          <div v-for="(_, i) in slides" :key="i"
            class="w-1.5 h-1.5 rounded-full transition-all"
            :class="previewSlide === i ? 'bg-primary w-3' : 'bg-white/40'"
          />
        </div>
        <div class="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
          <Eye class="w-3 h-3 inline mr-1" />Aperçu
        </div>
      </div>

      <!-- Liste slides -->
      <div class="space-y-2">
        <h2 class="font-bold text-sm text-gray-400 uppercase tracking-wider">Images ({{ slides.length }})</h2>
        <div v-for="(img, i) in slides" :key="img + i"
          class="bg-gray-900 border border-gray-800 rounded-xl flex items-center gap-3 p-2"
        >
          <img :src="img" class="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-gray-800" />
          <span class="flex-1 text-xs text-gray-400 truncate">{{ img }}</span>
          <div class="flex gap-1 flex-shrink-0">
            <button @click="moveUp(i)" :disabled="i === 0" class="p-1.5 hover:bg-gray-700 rounded-lg disabled:opacity-30 transition text-xs">↑</button>
            <button @click="moveDown(i)" :disabled="i === slides.length - 1" class="p-1.5 hover:bg-gray-700 rounded-lg disabled:opacity-30 transition text-xs">↓</button>
            <button @click="removeSlide(i)" class="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition">
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
        <button @click="resetToDefault" class="text-xs text-gray-500 hover:text-gray-300 underline mt-1">
          Remettre images par défaut
        </button>
      </div>

      <!-- Ajouter par URL -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h2 class="font-bold text-sm">Ajouter via URL</h2>
        <div class="flex gap-2">
          <input
            v-model="newUrl"
            @keydown.enter="addUrl"
            type="url"
            placeholder="https://... ou /splashscreen/xx.png"
            class="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button @click="addUrl" class="bg-primary text-black font-bold px-4 py-2 rounded-xl text-sm flex items-center gap-1">
            <Plus class="w-4 h-4" /> Ajouter
          </button>
        </div>
      </div>

      <!-- Upload image -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h2 class="font-bold text-sm flex items-center gap-2">
          <Upload class="w-4 h-4" /> Ajouter une image
        </h2>
        <div v-if="error" class="bg-red-900/30 text-red-400 text-xs p-3 rounded-xl">{{ error }}</div>
        <label class="flex items-center gap-3 bg-gray-800 border border-dashed border-gray-600 rounded-xl p-4 cursor-pointer hover:border-primary transition">
          <Upload class="w-5 h-5 text-gray-400" />
          <span class="text-sm text-gray-400">{{ uploading ? 'Chargement...' : 'Choisir une image' }}</span>
          <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="handleFileUpload" :disabled="uploading" />
        </label>
      </div>

    </div>
  </div>
</template>
