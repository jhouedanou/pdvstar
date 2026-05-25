<script setup>
import { ref, computed, watch } from 'vue'
import { COUNTRY_CODES } from '../constants/countries'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps({
    modelValue: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    autocomplete: { type: String, default: 'tel' }
})
const emit = defineEmits(['update:modelValue'])

const showDropdown = ref(false)
const selectedCountry = ref(COUNTRY_CODES[0])
const localNumber = ref('')

// Computed déclaré AVANT les watchers qui l'utilisent
const currentFullPhone = computed(() => selectedCountry.value.code + localNumber.value.replace(/\D/g, ''))

// Parser modelValue : détecter pays par préfixe
const parseModelValue = (val) => {
    if (!val) {
        localNumber.value = ''
        return
    }
    const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length)
    for (const c of sorted) {
        if (val.startsWith(c.code)) {
            selectedCountry.value = c
            localNumber.value = val.slice(c.code.length).replace(/\D/g, '')
            return
        }
    }
    // Fallback : tout dans local
    localNumber.value = val.replace(/\D/g, '')
}

// Sync depuis l'extérieur (modelValue change) vers state local
watch(() => props.modelValue, (v) => {
    if (v !== currentFullPhone.value) parseModelValue(v)
}, { immediate: true })

// Sync depuis state local vers parent
watch(currentFullPhone, (v) => {
    if (v !== props.modelValue) emit('update:modelValue', v)
})

const selectCountry = (c) => {
    selectedCountry.value = c
    showDropdown.value = false
}

const effectivePlaceholder = computed(() => props.placeholder || selectedCountry.value.placeholder)
</script>

<template>
  <div class="relative">
    <div class="flex">
      <button
        type="button"
        @click="showDropdown = !showDropdown"
        class="bg-gray-900 border border-r-0 border-gray-700 rounded-l-xl px-3 flex items-center gap-1 text-gray-300 hover:bg-gray-800 transition text-sm"
      >
        <span class="text-base">{{ selectedCountry.flag }}</span>
        <span class="font-mono text-xs">{{ selectedCountry.code }}</span>
        <ChevronDown class="w-3 h-3 text-gray-500" />
      </button>
      <input
        v-model="localNumber"
        type="tel"
        :autocomplete="autocomplete"
        :placeholder="effectivePlaceholder"
        class="flex-1 bg-gray-900 text-white px-3 py-3 rounded-r-xl border border-gray-700 focus:border-primary focus:outline-none transition text-sm"
      />
    </div>

    <Teleport to="body">
      <div v-if="showDropdown" class="fixed inset-0 z-[100]" @click="showDropdown = false">
        <div class="absolute inset-0 bg-black/60" />
        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-900 border border-gray-700 rounded-2xl w-72 max-w-[90vw] max-h-[70vh] overflow-y-auto shadow-2xl"
          @click.stop>
          <div class="sticky top-0 bg-gray-900 border-b border-gray-800 px-4 py-3">
            <p class="text-white font-bold text-sm">Choisir un pays</p>
          </div>
          <ul>
            <li v-for="c in COUNTRY_CODES" :key="c.code">
              <button
                type="button"
                @click="selectCountry(c)"
                class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-800 transition text-left"
                :class="selectedCountry.code === c.code ? 'bg-gray-800/50' : ''"
              >
                <span class="text-xl">{{ c.flag }}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-white font-medium truncate">{{ c.name }}</p>
                  <p class="text-xs text-gray-500 font-mono">{{ c.code }}</p>
                </div>
                <span v-if="selectedCountry.code === c.code" class="text-primary text-sm">✓</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>
