<script setup>
import { ref, computed, watch } from 'vue'
import { ChevronDown, X, Check, Search } from 'lucide-vue-next'

const props = defineProps({
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] }, // string[] ou {value,label}[]
    placeholder: { type: String, default: 'Sélectionner...' },
    allowFreeText: { type: Boolean, default: true },
    clearable: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const query = ref(props.modelValue || '')
const inputRef = ref(null)

watch(() => props.modelValue, (v) => { query.value = v || '' })

const normalizedOptions = computed(() =>
    props.options.map(o => typeof o === 'string' ? { value: o, label: o } : o)
)

const filtered = computed(() => {
    const q = (query.value || '').toLowerCase().trim()
    if (!q) return normalizedOptions.value
    return normalizedOptions.value.filter(o =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    )
})

const selectOption = (opt) => {
    query.value = opt.label
    emit('update:modelValue', opt.value)
    open.value = false
}

const onInput = (e) => {
    query.value = e.target.value
    if (props.allowFreeText) emit('update:modelValue', e.target.value)
    open.value = true
}

const onFocus = () => { open.value = true }
const onBlur = () => { setTimeout(() => open.value = false, 150) }

const clear = () => {
    query.value = ''
    emit('update:modelValue', '')
    inputRef.value?.focus()
}
</script>

<template>
  <div class="relative">
    <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
    <input
      ref="inputRef"
      :value="query"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      :placeholder="placeholder"
      class="w-full bg-gray-900 border border-gray-700 rounded-xl pl-10 pr-16 py-3 text-sm text-white outline-none focus:border-primary transition"
    />
    <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
      <button v-if="clearable && query" @click="clear" type="button"
        class="p-1 hover:bg-gray-700 rounded transition">
        <X class="w-3.5 h-3.5 text-gray-500" />
      </button>
      <ChevronDown class="w-4 h-4 text-gray-500 transition-transform" :class="open ? 'rotate-180' : ''" />
    </div>

    <Transition name="fade">
      <div v-if="open && filtered.length"
        class="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl">
        <button
          v-for="opt in filtered" :key="opt.value"
          @mousedown.prevent="selectOption(opt)"
          type="button"
          class="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 flex items-center justify-between transition"
          :class="modelValue === opt.value ? 'bg-primary/10 text-primary' : ''"
        >
          <span>{{ opt.label }}</span>
          <Check v-if="modelValue === opt.value" class="w-4 h-4 text-primary" />
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
