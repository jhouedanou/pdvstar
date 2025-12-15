<script setup>
import { ref, computed, onMounted } from 'vue'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { Heart, MapPin, Share2, Loader } from 'lucide-vue-next'
import UserProfileModal from '../components/UserProfileModal.vue'
import { sendWhatsAppMessage, formatEventNotificationMessage } from '../services/greenApiService'

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

    sendingMessage.value = true
    messageError.value = ''
    messageSuccess.value = ''

    try {
        const message = formatEventNotificationMessage(
            event,
            userStore.user.name,
            userStore.user.phone
        )

        await sendWhatsAppMessage(userStore.user.phone, message)
        messageSuccess.value = `Message envoyé pour "${event.title}"!`
        
        // Clear success message after 3 seconds
        setTimeout(() => {
            messageSuccess.value = ''
        }, 3000)
    } catch (error) {
        console.error('Error sending WhatsApp message:', error)
        messageError.value = error.message || 'Erreur lors de l\'envoi du message'
    } finally {
        sendingMessage.value = false
    }
}
</script>

<template>
  <div class="h-screen bg-black text-white relative overflow-hidden">
    <!-- Header (Floating) -->
    <!-- Header (TikTok Style Tabs) -->
    <div class="absolute top-0 w-full z-20 pt-14 pb-10 bg-gradient-to-b from-black/80 to-transparent flex justify-center items-center gap-6 text-white font-bold drop-shadow-md pointer-events-auto">
       <button class="text-white/60 text-lg font-medium hover:text-white transition">Autour de moi</button>
       <div class="h-4 w-[1px] bg-white/20"></div>
       <button class="text-white text-xl font-bold border-b-2 border-primary pb-0.5 shadow-lg">À la une 🔥</button>
    </div>

    <!-- Vertical Feed -->
    <!-- Added scrollbar-hide via custom style or class if available, using inline style for safety here -->
    <div class="snap-y snap-mandatory h-full w-full overflow-y-scroll scroll-smooth no-scrollbar">
      <div v-for="event in eventStore.events" :key="event.id" 
           class="snap-start h-full w-full relative bg-dark-lighter flex items-end">
        
        <!-- Background Image/Video -->
        <!-- Added transition for image loading feel -->
        <div class="absolute inset-0 bg-gray-900">
           <video v-if="event.type === 'video'" :src="event.video" autoplay loop muted playsinline class="w-full h-full object-cover opacity-100"></video>
           <img v-else :src="event.image" alt="Event Cover" class="w-full h-full object-cover opacity-90" />
           <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90"></div>
        </div>
        
        <!-- Right Side Actions (Floating properly aligned) -->
        <div class="absolute right-2 bottom-24 flex flex-col gap-6 z-20 items-center">
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
             :disabled="sendingMessage"
             class="flex flex-col items-center gap-1 group disabled:opacity-50 disabled:cursor-not-allowed">
             <div class="relative">
               <Heart class="w-9 h-9 text-white group-active:scale-75 transition-transform duration-200 fill-white/10 hover:fill-red-500 hover:text-red-500"/>
               <Loader v-if="sendingMessage" class="absolute inset-0 w-9 h-9 animate-spin text-primary" />
             </div>
             <span class="text-xs font-semibold drop-shadow-md">J'y vais</span>
           </button>
           
           <button class="flex flex-col items-center gap-1 group">
             <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-active:scale-90 transition">
                <MapPin class="w-6 h-6 text-white"/>
             </div>
             <span class="text-xs font-semibold drop-shadow-md">Itinéraire</span>
           </button>

           <button class="flex flex-col items-center gap-1 group">
             <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-active:scale-90 transition">
                <Share2 class="w-6 h-6 text-white"/>
             </div>
             <span class="text-xs font-semibold drop-shadow-md">Partager</span>
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
        <div class="relative z-10 w-full pl-4 pr-16 pb-4 mb-16 flex flex-col items-start space-y-2 pointer-events-none">
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
          <div class="flex items-center gap-2 w-[70%] overflow-hidden">
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
    
    <!-- Bottom Navigation Bar -->
    <div class="fixed bottom-0 w-full z-30 bg-black text-white flex justify-around items-center h-16 border-t border-white/10 safe-area-bottom">
        <button class="flex flex-col items-center gap-1 opacity-100">
           <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 fill-white" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
           <span class="text-[10px] font-bold">Acceuil</span>
        </button>
        
        <button class="flex flex-col items-center gap-1 opacity-50">
           <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 stroke-white stroke-2 fill-none" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
           <span class="text-[10px] font-bold">Découvrir</span>
        </button>

        <!-- Center Add Button (TikTok Style) -->
        <router-link to="/pro/create" class="relative group">
            <div class="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-8 bg-[#00f2ea] rounded-lg transition group-active:translate-x-1"></div>
            <div class="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-8 bg-[#ff0050] rounded-lg transition group-active:-translate-x-1"></div>
            <div class="relative w-10 h-8 bg-white rounded-lg flex items-center justify-center z-10 transition group-active:scale-95">
                <span class="text-black font-bold text-xl leading-none">+</span>
            </div>
        </router-link>

        <button class="flex flex-col items-center gap-1 opacity-50">
           <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 stroke-white stroke-2 fill-none" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
           <span class="text-[10px] font-bold">Boîte de réception</span>
        </button>

        <router-link to="/pro" class="flex flex-col items-center gap-1 opacity-100 hover:opacity-100 transition">
           <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 stroke-primary stroke-2 fill-none" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
           <span class="text-[10px] font-bold text-primary">Espace Pro</span>
        </router-link>
    </div>

    <!-- User Profile Modal -->
    <UserProfileModal v-if="showProfileModal" @profile-created="handleProfileCreated" />

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
