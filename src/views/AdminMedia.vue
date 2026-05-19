<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../services/supabase'
import { ArrowLeft, Upload, Trash2, Copy, Image, Film, File, Folder, RefreshCw, Check, Search } from 'lucide-vue-next'

const router = useRouter()

const BUCKET = 'media'
const FOLDERS = ['', 'events/', 'ads/', 'splash/', 'misc/']

const files = ref([])
const loading = ref(false)
const fileSearch = ref('')

const filteredFiles = computed(() => {
    const q = fileSearch.value.toLowerCase()
    if (!q) return files.value
    return files.value.filter(f => f.name.toLowerCase().includes(q))
})
const uploading = ref(false)
const error = ref('')
const folder = ref('')
const fileInput = ref(null)
const copiedId = ref(null)
const selectedFiles = ref(new Set())

const loadFiles = async () => {
    loading.value = true
    error.value = ''
    try {
        const { data, error: e } = await supabase.storage
            .from(BUCKET)
            .list(folder.value, { sortBy: { column: 'created_at', order: 'desc' } })
        if (e) throw e
        files.value = data || []
    } catch (e) {
        error.value = `Erreur: ${e.message}. Vérifier que le bucket "${BUCKET}" existe.`
        files.value = []
    }
    loading.value = false
}

onMounted(loadFiles)

const publicUrl = (name) => {
    const path = folder.value ? `${folder.value}${name}` : name
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
}

const copyUrl = (name) => {
    const url = publicUrl(name)
    navigator.clipboard.writeText(url)
    copiedId.value = name
    setTimeout(() => copiedId.value = null, 2000)
}

const handleUpload = async (e) => {
    const fileList = e.target.files
    if (!fileList?.length) return
    uploading.value = true
    error.value = ''
    const results = []
    for (const file of fileList) {
        const path = `${folder.value}${Date.now()}_${file.name}`
        const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(path, file, { upsert: true })
        if (upErr) results.push(`${file.name}: ${upErr.message}`)
    }
    if (results.length) error.value = results.join('\n')
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
    await loadFiles()
}

const deleteFile = async (name) => {
    if (!confirm(`Supprimer ${name} ?`)) return
    const path = folder.value ? `${folder.value}${name}` : name
    const { error: e } = await supabase.storage.from(BUCKET).remove([path])
    if (e) { error.value = e.message; return }
    await loadFiles()
}

const deleteSelected = async () => {
    if (!selectedFiles.value.size) return
    if (!confirm(`Supprimer ${selectedFiles.value.size} fichier(s) ?`)) return
    const paths = [...selectedFiles.value].map(n => folder.value ? `${folder.value}${n}` : n)
    const { error: e } = await supabase.storage.from(BUCKET).remove(paths)
    if (e) { error.value = e.message; return }
    selectedFiles.value.clear()
    await loadFiles()
}

const toggleSelect = (name) => {
    if (selectedFiles.value.has(name)) selectedFiles.value.delete(name)
    else selectedFiles.value.add(name)
    selectedFiles.value = new Set(selectedFiles.value)
}

const isImage = (name) => /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(name)
const isVideo = (name) => /\.(mp4|webm|mov|avi)$/i.test(name)

const formatSize = (bytes) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
</script>

<template>
  <div class="text-white">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-xl font-bold text-slate-100">Médiathèque</h1>
        <p class="text-slate-400 text-sm">Bucket : <code class="text-blue-400">{{ BUCKET }}</code></p>
      </div>
      <button @click="loadFiles" class="p-2 hover:bg-slate-700 rounded-lg transition">
        <RefreshCw class="w-4 h-4 text-slate-400" :class="loading ? 'animate-spin' : ''" />
      </button>
    </div>

    <!-- Folder tabs -->
    <div class="flex gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-2">
      <button
        v-for="f in FOLDERS" :key="f"
        @click="folder = f; loadFiles()"
        class="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition border"
        :class="folder === f ? 'bg-blue-600 text-white border-blue-500' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'"
      >
        {{ f || 'Tout' }}
      </button>
    </div>

    <div class="space-y-4">

      <!-- Error -->
      <div v-if="error" class="bg-red-900/30 border border-red-800/40 text-red-400 text-sm p-4 rounded-xl">
        {{ error }}
      </div>

      <!-- Upload zone -->
      <label class="flex items-center gap-3 bg-gray-900 border-2 border-dashed border-gray-700 hover:border-primary rounded-xl p-4 cursor-pointer transition">
        <Upload class="w-6 h-6 text-gray-400" />
        <div>
          <p class="text-sm font-medium">{{ uploading ? 'Chargement...' : 'Ajouter des fichiers' }}</p>
        </div>
        <input ref="fileInput" type="file" multiple accept="image/*,video/*" class="hidden" @change="handleUpload" :disabled="uploading" />
      </label>

      <!-- Actions bulk -->
      <div v-if="selectedFiles.size" class="flex items-center justify-between bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-2">
        <span class="text-sm text-red-400">{{ selectedFiles.size }} sélectionné(s)</span>
        <button @click="deleteSelected" class="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1">
          <Trash2 class="w-3 h-3" /> Supprimer
        </button>
      </div>

      <!-- Search fichiers -->
      <div class="relative mb-3">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input v-model="fileSearch" type="text" placeholder="Rechercher un fichier..."
          class="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center text-gray-500 py-12">Chargement...</div>

      <!-- Files grid -->
      <div v-else-if="filteredFiles.length" class="grid grid-cols-2 gap-3">
        <div
          v-for="f in filteredFiles" :key="f.name"
          class="bg-gray-900 border rounded-xl overflow-hidden transition cursor-pointer"
          :class="selectedFiles.has(f.name) ? 'border-primary' : 'border-gray-800'"
          @click="toggleSelect(f.name)"
        >
          <!-- Preview -->
          <div class="aspect-square bg-gray-800 relative">
            <img v-if="isImage(f.name)" :src="publicUrl(f.name)" class="w-full h-full object-cover" loading="lazy" />
            <div v-else-if="isVideo(f.name)" class="w-full h-full flex items-center justify-center">
              <Film class="w-8 h-8 text-gray-600" />
            </div>
            <div v-else class="w-full h-full flex items-center justify-center">
              <File class="w-8 h-8 text-gray-600" />
            </div>
            <div v-if="selectedFiles.has(f.name)" class="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
              <Check class="w-3 h-3 text-black" />
            </div>
          </div>

          <!-- Info + actions -->
          <div class="p-2 space-y-1">
            <p class="text-xs text-gray-300 truncate">{{ f.name }}</p>
            <p class="text-[10px] text-gray-600">{{ formatSize(f.metadata?.size) }}</p>
            <div class="flex gap-1" @click.stop>
              <button @click="copyUrl(f.name)" class="flex-1 bg-gray-800 hover:bg-gray-700 text-xs py-1 rounded-lg flex items-center justify-center gap-1 transition">
                <component :is="copiedId === f.name ? Check : Copy" class="w-3 h-3" />
                {{ copiedId === f.name ? 'Copié' : 'URL' }}
              </button>
              <button @click="deleteFile(f.name)" class="p-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg transition">
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="!loading" class="text-center text-gray-600 py-16 space-y-2">
        <Image class="w-10 h-10 mx-auto opacity-30" />
        <p class="text-sm">Aucun fichier dans ce dossier</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
