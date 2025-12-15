<script setup>
import { Plus } from 'lucide-vue-next'
</script>

<template>
  <div class="p-4 h-screen flex flex-col">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-primary">Espace Pro</h1>
      <router-link to="/" class="text-gray-400 text-sm border border-gray-600 px-3 py-1 rounded-full">
        Sortir
      </router-link>
    </div>

    <!-- Active Events List -->
    <div class="flex-1">
      <h2 class="text-white mb-4">Mes événements actifs</h2>
      <div class="bg-surface rounded-xl p-4 flex gap-4 items-center">
         <img src="https://images.unsplash.com/photo-1542396601-dca920ea2807" class="w-16 h-16 rounded-lg object-cover" />
         <div>
            <h3 class="font-bold">Soirée Rumba</h3>
            <p class="text-primary text-sm">En cours...</p>
         </div>
      </div>
    </div>

    <!-- Floating Action Button for Creation -->
    <div class="flex justify-center mb-8">
       <router-link to="/pro/create" class="flex items-center gap-2 bg-primary text-black font-bold text-xl px-8 py-4 rounded-full shadow-lg hover:scale-105 transition">
         <Plus class="w-8 h-8"/>
         Nouvel Événement
       </router-link>
    </div>
  </div>
</template>
