<script setup>
import { useEventStore } from '../stores/eventStore'
import { Heart, MapPin, Share2 } from 'lucide-vue-next'

const store = useEventStore()
</script>

<template>
  <div class="h-screen bg-black text-white relative overflow-hidden">
    <!-- Header (Floating) -->
    <div class="absolute top-0 w-full z-20 p-4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
      <h1 class="text-primary font-extrabold text-2xl drop-shadow-lg tracking-tight">The Place to BEER 🍺</h1>
    </div>

    <!-- Vertical Feed -->
    <!-- Added scrollbar-hide via custom style or class if available, using inline style for safety here -->
    <div class="snap-y snap-mandatory h-full w-full overflow-y-scroll scroll-smooth no-scrollbar">
      <div v-for="event in store.events" :key="event.id" 
           class="snap-start h-full w-full relative bg-dark-lighter flex items-end">
        
        <!-- Background Image/Video -->
        <!-- Added transition for image loading feel -->
        <div class="absolute inset-0 bg-gray-900">
           <img :src="event.image" alt="Event Cover" class="w-full h-full object-cover opacity-90" />
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

           <button class="flex flex-col items-center gap-1 group">
             <Heart class="w-9 h-9 text-white group-active:scale-75 transition-transform duration-200 fill-white/10 hover:fill-red-500 hover:text-red-500"/>
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
        </div>

        <!-- Content Overlay (Bottom Left) -->
        <div class="relative z-10 w-full pl-4 pr-16 pb-8 flex flex-col items-start space-y-2">
          <!-- Promo Label -->
          <div v-if="event.id" class="animate-pulse bg-secondary/90 backdrop-blur-md text-white px-3 py-1 rounded-r-full rounded-tl-full text-sm font-black uppercase tracking-wider shadow-lg transform -rotate-1 origin-bottom-left">
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
          <p class="text-gray-200 text-sm line-clamp-2 w-[85%] leading-relaxed opacity-90">
            Ce soir grosse ambiance avec DJ Mombassa. Venez tôt pour les places assises ! #Rumba #Kinshasa
          </p>
        </div>

      </div>
    </div>
    
    <!-- Pro Button (Still accessible but cleaner) -->
    <router-link to="/pro" class="fixed top-4 right-4 bg-white/10 backdrop-blur-md text-white/80 p-2 rounded-full z-50">
       <span class="text-xs font-bold px-2">PRO</span>
    </router-link>
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
</style>
