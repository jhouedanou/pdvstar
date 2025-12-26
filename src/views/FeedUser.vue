<script setup>
import { ref, computed, onMounted } from 'vue'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { Heart, MapPin, Share2, Loader, Search, UserCircle, Home } from 'lucide-vue-next'
import UserProfileModal from '../components/UserProfileModal.vue'
// import RotateDeviceMessage from '../components/RotateDeviceMessage.vue' // Décommenter pour activer le message de rotation
import { sendEventNotification } from '../services/greenApiService'

const eventStore = useEventStore()
const userStore = useUserStore()

const showProfileModal = ref(false)
const sendingMessage = ref(false)
const messageError = ref('')
const messageSuccess = ref('')

onMounted(() => {
    // Show profile modal if user doesn't have a profile
    if (!userStore.isProfileComplete) {
        showProfileModal.value = true
    }
})

const handleProfileCreated = () => {
    showProfileModal.value = false
}

const handleJyVais = async (event) => {
    if (!userStore.user) {
        showProfileModal.value = true
        return
    }

    // Toggle registration state locally for the prototype
    if (!event.isRegistered) {
        event.isRegistered = true
        event.participantCount++
        messageSuccess.value = `✅ Inscription confirmée pour "${event.title}"!`
    } else {
        // Option to unregister if needed, or just show already registered
        messageSuccess.value = `Vous êtes déjà inscrit !`
    }
    
    // Clear success message after 3 seconds
    setTimeout(() => {
        messageSuccess.value = ''
    }, 3000)
}

const openMap = (location) => {
    // Open Google Maps with the location query
    const query = encodeURIComponent(location)
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
}
</script>

<template>
  <div class="responsive-container bg-black text-white relative overflow-hidden">
    <!-- Header (Floating) -->
    <!-- Header (TikTok Style Tabs) -->
    <div class="header-tabs absolute top-0 w-full z-20 pt-14 pb-10 bg-gradient-to-b from-black/80 to-transparent flex justify-center items-center gap-6 text-white font-bold drop-shadow-md pointer-events-auto">
       <button class="text-white/60 text-lg font-medium hover:text-white transition">Autour de moi</button>
       <div class="h-4 w-[1px] bg-white/20"></div>
       <button class="text-white text-xl font-bold border-b-2 border-primary pb-0.5 shadow-lg">À la une 🔥</button>
    </div>

    <!-- Vertical Feed -->
    <!-- Added scrollbar-hide via custom style or class if available, using inline style for safety here -->
    <div class="feed-container snap-y snap-mandatory h-full w-full overflow-y-scroll scroll-smooth no-scrollbar">
      <div v-for="event in eventStore.events" :key="event.id" 
           class="event-slide snap-start h-full w-full relative bg-dark-lighter flex items-end">
        
        <!-- Background Image/Video -->
        <!-- Added transition for image loading feel -->
        <div class="absolute inset-0 bg-gray-900">
           <video v-if="event.type === 'video'" :src="event.video" autoplay loop muted playsinline class="w-full h-full object-cover opacity-100"></video>
           <img v-else :src="event.image" alt="Event Cover" class="w-full h-full object-cover opacity-90" />
           <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90"></div>
        </div>
        
        <!-- Right Side Actions (Floating properly aligned) -->
        <div class="action-buttons absolute right-2 bottom-24 flex flex-col gap-6 z-20 items-center">
           <!-- Profile/Organizer Avatar (TikTok style) -->
           <div class="relative mb-2">
             <div class="w-12 h-12 rounded-full border-2 border-primary overflow-hidden p-0.5">
               <img :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${event.organizer}`" class="w-full h-full rounded-full bg-white" />
             </div>
             <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary rounded-full w-5 h-5 flex items-center justify-center border border-black">
               <span class="text-black text-xs font-bold">+</span>
             </div>
           </div>

            <button 
              @click="handleJyVais(event)"
              class="action-button flex flex-col items-center gap-1 group">
              <div class="relative">
                <Heart 
                    class="w-9 h-9 transition-transform duration-200" 
                    :class="event.isRegistered ? 'fill-green-500 text-green-500 scale-110' : 'text-white fill-white/10 group-active:scale-75'"
                />
              </div>
              <span class="action-button-text text-xs font-semibold drop-shadow-md">
                {{ event.isRegistered ? 'Inscrit' : `J'y vais` }}
              </span>
              <span class="text-[10px] font-bold">{{ event.participantCount }}</span>
            </button>
           
            <button @click="openMap(event.location)" class="action-button flex flex-col items-center gap-1 group">
              <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-active:scale-90 transition">
                 <MapPin class="w-6 h-6 text-white"/>
              </div>
              <span class="action-button-text text-xs font-semibold drop-shadow-md">Map</span>
            </button>

           <button class="action-button flex flex-col items-center gap-1 group">
             <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-active:scale-90 transition">
                <Share2 class="w-6 h-6 text-white"/>
             </div>
             <span class="action-button-text text-xs font-semibold drop-shadow-md">Partager</span>
           </button>

           <!-- Spinning Disc (TikTok Vibe) -->
           <div class="mt-4 relative">
              <div class="w-12 h-12 rounded-full bg-black border-[3px] border-dark-lighter flex items-center justify-center animate-spin-slow overflow-hidden">
                 <img :src="event.image" class="w-full h-full object-cover opacity-80" />
              </div>
              <!-- Floating Notes Animation would go here -->
           </div>
        </div>

        <!-- Content Overlay (Bottom Left) -->
        <!-- mb-16 to clear the bottom navigation -->
        <div class="event-content relative z-10 w-full pl-4 pr-16 pb-4 mb-16 flex flex-col items-start space-y-2 pointer-events-none">
          <!-- Promo Label -->
          <div class="animate-pulse bg-secondary/90 backdrop-blur-md text-white px-3 py-1 rounded-r-full rounded-tl-full text-sm font-black uppercase tracking-wider shadow-lg transform -rotate-1 origin-bottom-left inline-block">
            🔥 2 achetées = 1 offerte
          </div>

          <div class="max-w-[85%]">
            <h2 class="text-2xl font-bold leading-tight mb-1 text-white text-shadow">{{ event.title }}</h2>
            <div class="flex items-center text-gray-200 font-medium text-sm gap-2">
                <span class="flex items-center text-primary"><MapPin class="w-4 h-4 mr-0.5"/> {{ event.location }}</span>
                <span class="text-gray-400">•</span>
                <span class="text-gray-300">{{ event.distance }}</span>
            </div>
          </div>
          
          <!-- Collapsed Description (TikTok style) -->
          <p class="text-gray-200 text-sm line-clamp-2 w-[85%] leading-relaxed opacity-90 mb-2">
            {{ event.description || 'Découvrez cet événement incontournable!' }}
          </p>

          <!-- Music Ticker -->
          <div class="music-ticker flex items-center gap-2 w-[70%] overflow-hidden">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 fill-white animate-pulse" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              <div class="whitespace-nowrap animate-marquee text-xs font-medium">
                  <span class="mr-4">Son original - DJ Mombassa (Kinshasa Vibes)</span>
                  <span class="mr-4">Son original - DJ Mombassa (Kinshasa Vibes)</span>
                  <span class="mr-4">Son original - DJ Mombassa (Kinshasa Vibes)</span>
              </div>
          </div>
        </div>

      </div>
    </div>
    
    <!-- Simple Bottom Navigation (Home, Recherche, Profil) -->
    <div class="bottom-nav fixed bottom-0 w-full z-30 bg-black text-white flex justify-around items-center h-16 border-t border-white/10 safe-area-bottom">
        <button class="flex flex-col items-center gap-1 opacity-100 text-primary">
           <Home class="w-6 h-6" />
           <span class="text-[10px] font-bold">Home</span>
        </button>
        
        <button class="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition">
           <Search class="w-6 h-6" />
           <span class="text-[10px] font-bold">Recherche</span>
        </button>

        <button @click="showProfileModal = true" class="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition">
           <UserCircle class="w-6 h-6" />
           <span class="text-[10px] font-bold">Profil</span>
        </button>
    </div>

    <!-- User Profile Modal -->
    <UserProfileModal v-if="showProfileModal" @profile-created="handleProfileCreated" />
    
    <!-- Rotate Device Message (Optional - uncomment to enable) -->
    <!-- <RotateDeviceMessage /> -->

    <!-- Success Message Toast -->
    <transition name="fade">
      <div v-if="messageSuccess" class="fixed top-4 left-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-40 flex items-center gap-2">
        <span>✓</span>
        <span>{{ messageSuccess }}</span>
      </div>
    </transition>

    <!-- Error Message Toast -->
    <transition name="fade">
      <div v-if="messageError" class="fixed top-4 left-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-40 flex items-center gap-2">
        <span>✕</span>
        <span>{{ messageError }}</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* Utility to hide scrollbar but keep functionality */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.text-shadow {
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* Toast animations */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
