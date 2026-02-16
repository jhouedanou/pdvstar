<script setup>
import { computed, ref } from 'vue'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { Users, Calendar, MapPin, Heart, X, Check, Clock, Share2, Crown } from 'lucide-vue-next'

const props = defineProps({
    organizerName: {
        type: String,
        required: true
    }
})

const emit = defineEmits(['close'])

const eventStore = useEventStore()
const userStore = useUserStore()

// Filter events for this organizer
const organizerEvents = computed(() => {
    return eventStore.events.filter(e => e.organizer === props.organizerName)
})

const isFollowing = computed(() => {
    return userStore.user?.following?.includes(props.organizerName)
})

const toggleFollow = () => {
    userStore.toggleFollow(props.organizerName)
}

// Event Detail Modal Logic (Internal to Profile)
const selectedEvent = ref(null)

const openEvent = (event) => {
    selectedEvent.value = event
}

const closeEvent = () => {
    selectedEvent.value = null
}

const shareEvent = () => {
    if (navigator.share && selectedEvent.value) {
        navigator.share({
            title: selectedEvent.value.title,
            text: selectedEvent.value.description,
            url: window.location.href
        })
    }
}

const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const options = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
    return date.toLocaleDateString('fr-FR', options)
}
</script>

<template>
    <div class="fixed inset-0 bg-white dark:bg-black z-[60] flex flex-col overflow-y-auto transition-colors duration-300">
        <!-- Header -->
        <div class="sticky top-0 z-10 bg-white/80 dark:bg-black/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
            <button @click="$emit('close')" class="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                <X class="w-6 h-6 text-black dark:text-white" />
            </button>
            <span class="font-bold text-lg text-black dark:text-white truncate">{{ organizerName }}</span>
            <div class="w-10"></div> <!-- Spacer -->
        </div>

        <!-- Profile Info -->
        <div class="px-4 py-6 flex flex-col items-center">
            <!-- Avatar -->
            <div class="w-24 h-24 rounded-full p-1 border-2 border-primary mb-3">
                <img :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${organizerName}`" class="w-full h-full rounded-full bg-gray-100" />
            </div>
            
            <h1 class="text-2xl font-black italic text-black dark:text-white mb-1 center">{{ organizerName }}</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Organisateur certifié Abidjan 🇨🇮</p>

            <!-- Stats -->
            <div class="flex items-center gap-8 mb-6">
                <div class="text-center">
                    <span class="block font-bold text-xl text-black dark:text-white">{{ organizerEvents.length }}</span>
                    <span class="text-xs text-gray-500 uppercase tracking-wider">Événements</span>
                </div>
            </div>

            <!-- Actions -->
            <button 
                @click="toggleFollow"
                class="w-full max-w-xs py-2.5 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 mb-2"
                :class="isFollowing 
                    ? 'bg-gray-100 dark:bg-gray-800 text-black dark:text-white border border-gray-200 dark:border-gray-700' 
                    : 'bg-primary text-black hover:bg-primary/90'"
            >
                <span v-if="isFollowing">Abonné(e)</span>
                <span v-else>Suivre</span>
                <Check v-if="isFollowing" class="w-4 h-4" />
            </button>
        </div>

        <!-- Content Grid (Instagram Style) -->
        <div class="border-t border-gray-100 dark:border-gray-800">
            <div v-if="organizerEvents.length === 0" class="p-8 text-center text-gray-400">
                Aucun événement actif.
            </div>
            <div v-else class="grid grid-cols-3 gap-0.5">
                <div 
                    v-for="event in organizerEvents" 
                    :key="event.id"
                    @click="openEvent(event)" 
                    class="relative aspect-square cursor-pointer overflow-hidden group bg-gray-100 dark:bg-gray-900"
                >
                    <img :src="event.image" class="w-full h-full object-cover transition-all duration-300 group-hover:scale-110 group-hover:brightness-75" />
                    
                    <!-- Premium Badge -->
                    <div v-if="event.isPremium" class="absolute top-2 right-2">
                        <div class="bg-gradient-to-r from-yellow-400 to-amber-500 p-1.5 rounded-full shadow-lg">
                            <Crown class="w-3 h-3 text-black" />
                        </div>
                    </div>
                    
                    <!-- Hover Info Overlay -->
                    <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2">
                        <div class="text-white text-[10px] font-semibold truncate mb-1">{{ event.title }}</div>
                        <div class="flex items-center gap-2 text-white/80 text-[9px]">
                            <Users class="w-3 h-3" />
                            <span>{{ event.participantCount }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Event Detail Modal (Re-using Bottom Sheet style) -->
        <transition name="up">
            <div v-if="selectedEvent" class="fixed inset-0 z-[70] flex flex-col justify-end pointer-events-none">
                <div class="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" @click="closeEvent"></div>
                <div class="bg-white dark:bg-gray-900 w-full max-h-[85vh] rounded-t-3xl overflow-y-auto pointer-events-auto relative">
                     <!-- Cover -->
                    <div class="relative h-64">
                        <img :src="selectedEvent.image" class="w-full h-full object-cover">
                        
                        <!-- Premium Badge on Image -->
                        <div v-if="selectedEvent.isPremium" class="absolute top-4 left-4">
                            <div class="bg-gradient-to-r from-yellow-400 to-amber-500 px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                                <Crown class="w-4 h-4 text-black" />
                                <span class="text-xs font-bold text-black">PREMIUM</span>
                            </div>
                        </div>
                        
                        <!-- Action Buttons -->
                        <div class="absolute top-4 right-4 flex gap-2">
                            <button @click="shareEvent" class="bg-black/50 p-2 rounded-full text-white backdrop-blur-sm hover:bg-black/70 transition">
                                <Share2 class="w-5 h-5" />
                            </button>
                            <button @click="closeEvent" class="bg-black/50 p-2 rounded-full text-white backdrop-blur-sm hover:bg-black/70 transition">
                                <X class="w-5 h-5" />
                            </button>
                        </div>
                        
                        <!-- Gradient overlay -->
                        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    </div>
                    
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-3">
                            <span class="bg-primary/20 text-primary-dark dark:text-primary text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                                {{ selectedEvent.type === 'video' ? 'Ambiance' : 'Événement' }}
                            </span>
                            <span v-if="selectedEvent.isPremium && selectedEvent.price" class="text-lg font-bold text-amber-500">
                                {{ selectedEvent.price.toLocaleString() }} CFA
                            </span>
                        </div>
                        
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">{{ selectedEvent.title }}</h2>
                        
                        <!-- Date & Time -->
                        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <Clock class="w-4 h-4" />
                            <span>{{ formatDate(selectedEvent.date) }}</span>
                        </div>
                        
                        <!-- Location -->
                        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                            <MapPin class="w-4 h-4" />
                            <span>{{ selectedEvent.location }}</span>
                        </div>
                        
                        <!-- Participants -->
                        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
                            <Users class="w-4 h-4" />
                            <span>{{ selectedEvent.participantCount }} personnes intéressées</span>
                        </div>
                        
                        <!-- Premium Features -->
                        <div v-if="selectedEvent.isPremium && selectedEvent.features?.length" class="mb-4">
                            <h3 class="text-sm font-bold text-gray-900 dark:text-white mb-2">✨ Avantages Premium</h3>
                            <div class="flex flex-wrap gap-2">
                                <span 
                                    v-for="feature in selectedEvent.features" 
                                    :key="feature"
                                    class="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800"
                                >
                                    {{ feature }}
                                </span>
                            </div>
                        </div>
                        
                        <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{{ selectedEvent.description }}</p>

                        <button 
                            class="w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                            :class="selectedEvent.isPremium 
                                ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black hover:from-yellow-500 hover:to-amber-600' 
                                : 'bg-primary text-black hover:bg-primary/90'"
                        >
                            <Crown v-if="selectedEvent.isPremium" class="w-5 h-5" />
                            <span>{{ selectedEvent.isPremium ? 'Réserver (Premium)' : 'Je suis intéressé(e)' }}</span>
                        </button>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.center {
    text-align: center;
}
.up-enter-active, .up-leave-active {
  transition: transform 0.3s ease-in-out;
}
.up-enter-from, .up-leave-to {
  transform: translateY(100%);
}
</style>
