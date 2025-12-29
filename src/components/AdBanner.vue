<script setup>
import { defineProps } from 'vue'
import { ExternalLink } from 'lucide-vue-next'

const props = defineProps({
    ad: {
        type: Object,
        required: true
    }
})

const handleAdClick = () => {
    if (props.ad.link && props.ad.link !== '#') {
        window.open(props.ad.link, '_blank')
    }
}
</script>

<template>
  <div class="event-slide snap-start h-full w-full relative bg-dark-lighter flex items-end cursor-pointer" @click="handleAdClick">

    <!-- Background Image -->
    <div class="absolute inset-0 bg-gray-900">
       <img :src="ad.image" alt="Advertisement" class="w-full h-full object-cover opacity-90" />
       <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90"></div>
    </div>

    <!-- Sponsored Label (Top Right) -->
    <div class="absolute top-20 right-4 z-20">
        <div class="bg-yellow-400/90 backdrop-blur-sm text-black px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <span>📢</span>
            <span>SPONSORISÉ</span>
        </div>
    </div>

    <!-- Right Side Actions (Minimal for Ad) -->
    <div class="action-buttons absolute right-2 bottom-24 flex flex-col gap-6 z-20 items-center">
       <!-- Sponsor Logo/Avatar -->
       <div class="relative mb-2">
         <div class="w-12 h-12 rounded-full border-2 border-yellow-400 overflow-hidden p-0.5 bg-white">
           <img :src="`https://api.dicebear.com/7.x/initials/svg?seed=${ad.sponsor}`" class="w-full h-full rounded-full" />
         </div>
       </div>

        <button
          class="action-button flex flex-col items-center gap-1 group"
        >
          <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-active:scale-90 transition">
             <ExternalLink class="w-6 h-6 text-white"/>
          </div>
          <span class="action-button-text text-xs font-semibold drop-shadow-md">Voir +</span>
        </button>
    </div>

    <!-- Content Overlay (Bottom Left) -->
    <div class="event-content relative z-10 w-full pl-4 pr-16 pb-4 mb-16 flex flex-col items-start space-y-2 pointer-events-none">
      <!-- Ad Badge -->
      <div class="bg-yellow-400/90 backdrop-blur-md text-black px-3 py-1 rounded-r-full rounded-tl-full text-sm font-black uppercase tracking-wider shadow-lg inline-block">
        ✨ {{ ad.sponsor }}
      </div>

      <div class="max-w-[85%]">
        <h2 class="text-2xl font-bold leading-tight mb-1 text-white text-shadow">{{ ad.title }}</h2>
      </div>

      <!-- Description -->
      <p class="text-gray-200 text-sm w-[85%] leading-relaxed opacity-90 mb-2">
        {{ ad.description }}
      </p>

      <!-- CTA -->
      <div class="pointer-events-auto mt-2">
        <button class="bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-6 py-2 rounded-full text-sm shadow-lg transition-transform active:scale-95 flex items-center gap-2">
            <span>En savoir plus</span>
            <ExternalLink class="w-4 h-4" />
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.text-shadow {
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}
</style>
