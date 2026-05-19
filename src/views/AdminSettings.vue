<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../services/supabase'
import { Save, Upload, RotateCcw } from 'lucide-vue-next'

const DEFAULTS = {
    name: 'BABI VIBES',
    tagline: 'La nightlife d\'Abidjan à portée de main',
    iconUrl: '/appIcon.svg',
}

const appName = ref(DEFAULTS.name)
const appTagline = ref(DEFAULTS.tagline)
const appIconUrl = ref(DEFAULTS.iconUrl)

const uploading = ref(false)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const fileInput = ref(null)
const iconPreviewError = ref(false)

onMounted(() => {
    appName.value = localStorage.getItem('pdvstar_app_name') || DEFAULTS.name
    appTagline.value = localStorage.getItem('pdvstar_app_tagline') || DEFAULTS.tagline
    appIconUrl.value = localStorage.getItem('pdvstar_app_icon') || DEFAULTS.iconUrl
})

const uploadIcon = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    uploading.value = true
    error.value = ''
    try {
        const ext = file.name.split('.').pop()
        const path = `misc/appIcon_${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
            .from('media')
            .upload(path, file, { upsert: true })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        appIconUrl.value = publicUrl
        iconPreviewError.value = false
    } catch (e) {
        error.value = `Upload échoué : ${e.message}`
    }
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
}

const save = () => {
    saving.value = true
    localStorage.setItem('pdvstar_app_name', appName.value)
    localStorage.setItem('pdvstar_app_tagline', appTagline.value)
    localStorage.setItem('pdvstar_app_icon', appIconUrl.value)
    setTimeout(() => {
        saving.value = false
        saved.value = true
        setTimeout(() => saved.value = false, 2500)
    }, 300)
}

const reset = (field) => {
    if (field === 'name') appName.value = DEFAULTS.name
    if (field === 'tagline') appTagline.value = DEFAULTS.tagline
    if (field === 'icon') { appIconUrl.value = DEFAULTS.iconUrl; iconPreviewError.value = false }
}
</script>

<template>
  <div class="text-white max-w-2xl">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-100">Paramètres de l'app</h1>
        <p class="text-slate-400 text-sm">Nom, icone, accroche — stockés côté client</p>
      </div>
      <button
        @click="save"
        :disabled="saving"
        class="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition"
      >
        <Save class="w-4 h-4" />
        {{ saved ? 'Sauvegardé !' : saving ? '...' : 'Sauvegarder' }}
      </button>
    </div>

    <!-- Preview -->
    <div class="bg-black rounded-2xl p-8 flex flex-col items-center gap-3 mb-6 border border-slate-700/40">
      <img
        :src="appIconUrl"
        :alt="appName"
        class="w-16 h-16 rounded-2xl object-contain"
        @error="iconPreviewError = true"
      />
      <p class="text-2xl font-black text-yellow-400 tracking-tight">{{ appName }}</p>
      <p class="text-slate-400 text-sm">{{ appTagline }}</p>
      <p class="text-slate-600 text-xs mt-1">Aperçu splash screen</p>
    </div>

    <div v-if="error" class="bg-red-900/30 text-red-400 text-sm p-3 rounded-xl mb-4">{{ error }}</div>

    <div class="space-y-5">

      <!-- Nom -->
      <div class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Nom de l'app</label>
        <div class="flex gap-2">
          <input
            v-model="appName"
            type="text"
            maxlength="30"
            class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button @click="reset('name')" class="p-2.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition">
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
        <p class="text-[10px] text-slate-600 mt-1.5">Affiché sur le splash screen et le header. Max 30 caractères.</p>
      </div>

      <!-- Tagline -->
      <div class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Accroche</label>
        <div class="flex gap-2">
          <input
            v-model="appTagline"
            type="text"
            maxlength="60"
            class="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button @click="reset('tagline')" class="p-2.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition">
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Icone -->
      <div class="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400">Icone</label>

        <div class="flex items-center gap-4">
          <img
            :src="appIconUrl"
            class="w-14 h-14 rounded-xl object-contain bg-slate-900 border border-slate-700 p-1"
            @error="iconPreviewError = true"
          />
          <div class="flex-1 space-y-2">
            <input
              v-model="appIconUrl"
              type="url"
              placeholder="URL icone (https://... ou /appIcon.svg)"
              class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              @input="iconPreviewError = false"
            />
            <label class="flex items-center gap-2 cursor-pointer text-xs text-blue-400 hover:text-blue-300 transition">
              <Upload class="w-3.5 h-3.5" />
              {{ uploading ? 'Upload...' : 'Ou uploader depuis Supabase Storage' }}
              <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="uploadIcon" :disabled="uploading" />
            </label>
          </div>
          <button @click="reset('icon')" class="p-2.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition flex-shrink-0">
            <RotateCcw class="w-4 h-4" />
          </button>
        </div>
        <p class="text-[10px] text-slate-600">
          Formats recommandés : SVG, PNG. Upload dans bucket <code class="text-blue-400">media/misc/</code>.
          Pour changer le favicon et l'icone PWA, modifier <code class="text-blue-400">public/appIcon.svg</code> et rebuilder.
        </p>
      </div>

      <!-- Note -->
      <div class="bg-slate-800/20 border border-slate-700/30 rounded-xl p-4 text-xs text-slate-500 space-y-1">
        <p class="font-semibold text-slate-400">Note technique</p>
        <p>Ces paramètres sont stockés en localStorage sur chaque navigateur (pas en DB). Pour une persistance globale, ajouter une table <code>app_settings(key, value)</code> dans Supabase et lire au chargement.</p>
        <p>Le favicon (onglet navigateur) et l'icone PWA (installation) nécessitent un rebuild — ils sont dans <code>public/appIcon.svg</code>.</p>
      </div>

    </div>
  </div>
</template>
