<script setup>
import { useEventStore } from '../stores/eventStore'
import { Heart, MapPin, Share2 } from 'lucide-vue-next'

const store = useEventStore()
</script>

<template>
  <div class="pb-20"> <!-- Padding for bottom nav maybe? or just scroll -->
    <!-- Header -->
    <div class="fixed top-0 w-full z-10 p-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
      <h1 class="text-primary font-bold text-2xl drop-shadow-md">The Place to BEER 🍺</h1>
    </div>

    <!-- Vertical Feed -->
    <div class="space-y-1 snap-y snap-mandatory h-screen overflow-y-scroll">
      <div v-for="event in store.events" :key="event.id" 
           class="snap-start h-screen w-full relative bg-dark-lighter flex items-end">
        
        <!-- Background Image -->
        <img :src="event.image" alt="Event Cover" class="absolute inset-0 w-full h-full object-cover brightness-75" />
        
        <!-- Content Overlay -->
        <div class="relative z-10 w-full p-6 bg-gradient-to-t from-black via-black/50 to-transparent pb-32">
          <span class="bg-secondary text-white px-2 py-1 rounded text-sm font-bold mb-2 inline-block">2 bières = 1 offerte</span>
          <h2 class="text-3xl font-bold mb-1">{{ event.title }}</h2>
          <div class="flex items-center text-gray-200 mb-1">
             <MapPin class="w-5 h-5 mr-1 text-primary"/>
             <span class="text-lg">{{ event.location }} ({{ event.distance }})</span>
          </div>
          <p class="text-gray-300">Ce soir à 20h</p>
        </div>

        <!-- Right Side Actions -->
        <div class="absolute right-4 bottom-32 flex flex-col gap-6 z-20">
           <button class="flex flex-col items-center gap-1">
             <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
               <Heart class="w-8 h-8 text-white fill-transparent hover:fill-red-500 hover:text-red-500 transition"/>
             </div>
             <span class="text-xs font-bold shadow-black drop-shadow-md">J'y vais</span>
           </button>
           
           <button class="flex flex-col items-center gap-1">
             <div class="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
               <Share2 class="w-8 h-8 text-white"/>
             </div>
             <span class="text-xs font-bold shadow-black drop-shadow-md">Partager</span>
           </button>
        </div>

      </div>
    </div>
    
    <!-- Pro Button Overlay for Demo Purpose -->
    <router-link to="/pro" class="fixed bottom-6 right-6 bg-primary text-black px-4 py-2 rounded-full font-bold z-50 shadow-lg">
      Mode Pro
    </router-link>
  </div>
</template>
