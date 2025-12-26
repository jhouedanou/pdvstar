<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { RotateCw } from 'lucide-vue-next'

const showMessage = ref(false)

const checkOrientation = () => {
  // Show message only on small screens in landscape mode
  if (window.matchMedia('(orientation: landscape) and (max-width: 900px) and (max-height: 500px)').matches) {
    showMessage.value = true
  } else {
    showMessage.value = false
  }
}

onMounted(() => {
  checkOrientation()
  window.addEventListener('resize', checkOrientation)
  window.addEventListener('orientationchange', checkOrientation)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkOrientation)
  window.removeEventListener('orientationchange', checkOrientation)
})

const dismissMessage = () => {
  showMessage.value = false
}
</script>

<template>
  <transition name="fade">
    <div v-if="showMessage" class="rotate-message" @click="dismissMessage">
      <div class="flex flex-col items-center gap-6 max-w-sm px-6">
        <RotateCw class="w-20 h-20 text-primary animate-bounce" />
        <h2 class="text-2xl font-bold text-center">Tournez votre appareil</h2>
        <p class="text-center text-gray-300">
          Pour une meilleure expérience, veuillez utiliser l'application en mode portrait.
        </p>
        <button 
          @click="dismissMessage"
          class="mt-4 px-6 py-3 bg-primary text-black font-bold rounded-lg hover:bg-yellow-500 transition">
          Continuer quand même
        </button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
