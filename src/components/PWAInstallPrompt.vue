<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const show = ref(false)
const deferredPrompt = ref(null)
const installing = ref(false)
let readyPoll = null

const DISMISS_KEY = 'pwa_install_dismissed_at'
const DISMISS_DAYS = 7

function isDismissed() {
  const ts = localStorage.getItem(DISMISS_KEY)
  if (!ts) return false
  return Date.now() - Number(ts) < DISMISS_DAYS * 86400_000
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
}

function isExperienceReady() {
  return localStorage.getItem('pdvstar_splash_entered') === '1'
    && localStorage.getItem('pdvstar_onboarding_done') === '1'
    && !document.querySelector('[data-pdv-modal]')
}

function scheduleShow() {
  if (!deferredPrompt.value || isDismissed() || isStandalone()) return
  if (!isExperienceReady()) return
  window.clearInterval(readyPoll)
  readyPoll = null
  setTimeout(() => {
    if (deferredPrompt.value && !isDismissed() && !isStandalone() && isExperienceReady()) {
      show.value = true
    }
  }, 8000)
}

function onBeforeInstall(e) {
  e.preventDefault()
  deferredPrompt.value = e
  scheduleShow()
  if (!readyPoll) {
    readyPoll = window.setInterval(scheduleShow, 3000)
  }
}

async function install() {
  if (!deferredPrompt.value) return
  installing.value = true
  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  deferredPrompt.value = null
  installing.value = false
  show.value = false
  if (outcome === 'dismissed') {
    localStorage.setItem(DISMISS_KEY, Date.now())
  }
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, Date.now())
  show.value = false
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstall)
  window.addEventListener('pdvstar:experience-ready', scheduleShow)
})
onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  window.removeEventListener('pdvstar:experience-ready', scheduleShow)
  window.clearInterval(readyPoll)
})
</script>

<template>
  <Transition name="slide-up">
    <div v-if="show" class="pwa-overlay" @click.self="dismiss">
      <div class="pwa-sheet" role="dialog" aria-modal="true" aria-label="Installer l'application">
        <div class="pwa-handle" />

        <div class="pwa-header">
          <img src="/appIcon.svg" alt="BABI VIBES" class="pwa-icon" />
          <div class="pwa-info">
            <strong>BABI VIBES</strong>
            <span>Nightlife Abidjan 🇨🇮</span>
          </div>
        </div>

        <p class="pwa-desc">
          Installe l'app pour un accès rapide, notifications et mode hors-ligne.
        </p>

        <div class="pwa-actions">
          <button class="btn-install" :disabled="installing" @click="install">
            <span v-if="installing">Installation…</span>
            <span v-else>Installer</span>
          </button>
          <button class="btn-dismiss" @click="dismiss">Plus tard</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
}

.pwa-sheet {
  width: 100%;
  background: #1a1a1a;
  border-radius: 20px 20px 0 0;
  padding: 16px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pwa-handle {
  width: 40px;
  height: 4px;
  background: #444;
  border-radius: 2px;
  align-self: center;
  margin-bottom: 4px;
}

.pwa-header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.pwa-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: #FFD700;
  padding: 6px;
  flex-shrink: 0;
}

.pwa-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pwa-info strong {
  font-size: 17px;
  color: #FFD700;
  font-weight: 700;
}

.pwa-info span {
  font-size: 13px;
  color: #aaa;
}

.pwa-desc {
  font-size: 14px;
  color: #ccc;
  line-height: 1.5;
  margin: 0;
}

.pwa-actions {
  display: flex;
  gap: 12px;
}

.btn-install {
  flex: 1;
  background: #FFD700;
  color: #000;
  font-weight: 700;
  font-size: 15px;
  border: none;
  border-radius: 12px;
  padding: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-install:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-dismiss {
  flex: 0 0 auto;
  background: transparent;
  color: #888;
  font-size: 14px;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 14px 20px;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-dismiss:hover {
  color: #ccc;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.3s, transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}
</style>
