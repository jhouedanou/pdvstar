<script setup>
import { computed, ref } from 'vue'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { Users, Calendar, MapPin, Heart, X, Check } from 'lucide-vue-next'

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

// Mock stats
const travelersCount = computed(() => {
    return organizerEvents.value.reduce((acc, curr) => acc + (curr.participantCount || 0), 0) + 1200
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
                    <span class="text-xs text-gray-500 uppercase tracking-wider">Events</span>
                </div>
                <div class="text-center">
                    <span class="block font-bold text-xl text-black dark:text-white">{{ (travelersCount / 1000).toFixed(1) }}k</span>
                    <span class="text-xs text-gray-500 uppercase tracking-wider">Travelers</span>
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
                    <img :src="event.image" class="w-full h-full object-cover transition duration-300 group-hover:scale-110" />
                    <!-- Video Indicator -->
                    <div v-if="event.type === 'video'" class="absolute top-1 right-1">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white drop-shadow-md">
                            <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" />
                        </svg>
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
                    <div class="relative h-56">
                        <img :src="selectedEvent.image" class="w-full h-full object-cover">
                        <button @click="closeEvent" class="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white backdrop-blur-sm">
                            <X class="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div class="p-6">
                        <span class="bg-primary/20 text-primary-dark dark:text-primary text-[10px] font-bold px-2 py-1 rounded mb-2 inline-block uppercase">
                             {{ selectedEvent.type === 'video' ? 'Ambiance' : 'Événement' }}
                        </span>
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{{ selectedEvent.title }}</h2>
                        <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                            <MapPin class="w-4 h-4" />
                            <span>{{ selectedEvent.location }}</span>
                        </div>
                        <p class="text-gray-700 dark:text-gray-300 leading-relaxed mb-6">{{ selectedEvent.description }}</p>

                        <button 
                             class="w-full py-4 rounded-xl font-bold bg-primary text-black flex items-center justify-center gap-2"
                        >
                            Je suis intéressé(e)
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
