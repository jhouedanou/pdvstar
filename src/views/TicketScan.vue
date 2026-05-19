<script setup>
import { ref, shallowRef, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/userStore'
import { redeemTicket } from '../services/ticketService'
import { ArrowLeft, ScanLine, CheckCircle2, XCircle, RotateCcw } from 'lucide-vue-next'

const router = useRouter()
const userStore = useUserStore()

const QrStream = shallowRef(null)
const cameraReady = ref(false)
const lastResult = ref(null)
const error = ref('')
const scanning = ref(true)

onMounted(async () => {
    try {
        const mod = await import('vue-qrcode-reader')
        QrStream.value = mod.QrcodeStream
        cameraReady.value = true
    } catch (e) {
        error.value = 'Module scanner indisponible. yarn add vue-qrcode-reader'
    }
})

const onDetect = async (codes) => {
    if (!scanning.value) return
    const token = codes[0]?.rawValue
    if (!token) return
    scanning.value = false
    error.value = ''
    try {
        const res = await redeemTicket(token, userStore.user?.id || null)
        lastResult.value = res
    } catch (e) {
        error.value = e.message
    }
}

const reset = () => {
    lastResult.value = null
    error.value = ''
    scanning.value = true
}
</script>

<template>
  <div class="min-h-screen bg-black text-white flex flex-col">
    <header class="sticky top-0 bg-surface border-b border-gray-800 px-4 py-3 flex items-center gap-3 z-40">
      <button @click="router.back()" class="text-gray-400"><ArrowLeft class="w-5 h-5" /></button>
      <h1 class="font-bold flex items-center gap-2"><ScanLine class="w-5 h-5 text-primary" /> Contrôle accès</h1>
    </header>

    <main class="flex-1 flex flex-col items-center justify-center p-4">
      <div v-if="error" class="bg-red-900/20 text-red-400 text-sm p-3 rounded-xl mb-4">{{ error }}</div>

      <!-- Scanner -->
      <div v-if="!lastResult && cameraReady" class="w-full max-w-sm aspect-square bg-gray-900 rounded-2xl overflow-hidden border-2 border-primary/50">
        <component :is="QrStream" @detect="onDetect" class="w-full h-full" />
      </div>

      <!-- Success -->
      <div v-else-if="lastResult?.ok" class="text-center">
        <CheckCircle2 class="w-24 h-24 text-green-500 mx-auto mb-4" />
        <h2 class="text-2xl font-bold mb-2">Accès validé</h2>
        <p class="text-gray-400 text-sm">{{ lastResult.ticket?.buyer_pseudo }} — {{ lastResult.ticket?.buyer_phone }}</p>
        <button @click="reset" class="mt-6 bg-primary text-black font-bold px-6 py-3 rounded-xl flex items-center gap-2 mx-auto">
          <RotateCcw class="w-4 h-4" /> Scanner suivant
        </button>
      </div>

      <!-- Reject -->
      <div v-else-if="lastResult && !lastResult.ok" class="text-center">
        <XCircle class="w-24 h-24 text-red-500 mx-auto mb-4" />
        <h2 class="text-2xl font-bold mb-2">Refusé</h2>
        <p class="text-red-400 text-sm">{{ lastResult.reason }}</p>
        <button @click="reset" class="mt-6 bg-gray-800 text-white px-6 py-3 rounded-xl flex items-center gap-2 mx-auto">
          <RotateCcw class="w-4 h-4" /> Réessayer
        </button>
      </div>

      <p v-if="cameraReady && !lastResult" class="text-gray-500 text-sm mt-4">Centrez le QR code dans le cadre</p>
    </main>
  </div>
</template>
