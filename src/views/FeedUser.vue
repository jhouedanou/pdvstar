<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { useGeolocation } from '@vueuse/core'
import { Heart, MapPin, Share2, Loader, Search, UserCircle, Home, X, Calendar, Plus, Map as MapIcon, Sun, Moon, Crown } from 'lucide-vue-next'
import UserProfileModal from '../components/UserProfileModal.vue'
import OrganizerProfile from '../components/OrganizerProfile.vue'
import AdBanner from '../components/AdBanner.vue'
import L from 'leaflet'
// import RotateDeviceMessage from '../components/RotateDeviceMessage.vue' // Décommenter pour activer le message de rotation
import { sendEventNotification, sendWhatsAppLocation } from '../services/greenApiService'
import { db } from '../services/db'

const eventStore = useEventStore()
const userStore = useUserStore()

const showProfileModal = ref(false)
const sendingMessage = ref(false)
const messageError = ref('')
const messageSuccess = ref('')
const { coords, resume } = useGeolocation()

// Get Ads from DB
const ads = ref(db.getAds())

// Mix events and ads (every 5 events, insert an ad)
const feedItems = computed(() => {
    const items = []
    const events = eventStore.events
    const adsList = ads.value

    events.forEach((event, index) => {
        items.push({ type: 'event', data: event })

        // Insert ad every 5 events
        if ((index + 1) % 5 === 0 && adsList[Math.floor(index / 5) % adsList.length]) {
            items.push({
                type: 'ad',
                data: adsList[Math.floor(index / 5) % adsList.length]
            })
        }
    })

    return items
})

// Toast State
const showToast = ref(false)
const toastEvent = ref(null)

// Haversine Distance Helper
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371 // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1)
  const dLon = deg2rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

const deg2rad = (deg) => {
  return deg * (Math.PI / 180)
}

const checkNearbyEvents = () => {
    // Find closest event
    let closest = null
    let minDist = Infinity
    
    eventStore.events.forEach(event => {
        if (event.coords) {
            const d = getDistanceFromLatLonInKm(
                coords.value.latitude, coords.value.longitude,
                event.coords.lat, event.coords.lng
            )
            if (d < minDist) {
                minDist = d
                closest = event
            }
        }
    })

    // If close enough (< 5km) and not registered
    if (closest && minDist < 5 && !closest.isRegistered) {
        toastEvent.value = closest
        showToast.value = true
        // Auto hide after 8s
        setTimeout(() => showToast.value = false, 8000)
    }
}

const scrollToEvent = (id) => {
    showToast.value = false
    // Ideally scroll, but for now just acknowledge
    // activeTab.value = 'feed'
}

// Wheel scroll handling for feed
const feedContainer = ref(null)
let isScrolling = false
let scrollTimeout = null

const handleWheel = (e) => {
    if (!feedContainer.value) return
    
    // Prevent default scroll behavior
    e.preventDefault()
    
    // Clear previous timeout
    if (scrollTimeout) {
        clearTimeout(scrollTimeout)
    }
    
    // Avoid multiple rapid scrolls
    if (isScrolling) return
    
    const delta = e.deltaY
    const threshold = 50 // Sensitivity threshold
    
    if (Math.abs(delta) > threshold) {
        isScrolling = true
        
        // Scroll to next/previous slide
        const container = feedContainer.value
        const slideHeight = container.clientHeight
        const currentScroll = container.scrollTop
        const direction = delta > 0 ? 1 : -1
        const targetScroll = currentScroll + (slideHeight * direction)
        
        // Smooth scroll to target
        container.scrollTo({
            top: targetScroll,
            behavior: 'smooth'
        })
        
        // Reset scrolling flag after animation
        setTimeout(() => {
            isScrolling = false
        }, 800)
    }
}

onMounted(() => {
    // Show profile modal if user doesn't have a profile
    if (!userStore.isProfileComplete) {
        showProfileModal.value = true
    }

    // Check Location Recommendations
    if (coords.value.latitude !== Infinity) {
        checkNearbyEvents()
    } else {
        resume() // Try ensuring permission
        // Watch for coord update once
        const unwatch = watch(coords, (newCoords) => {
            if (newCoords.latitude !== Infinity) {
                checkNearbyEvents()
                unwatch()
            }
        })
    }
    
    // Add wheel event listener for mouse/trackpad scroll
    if (feedContainer.value) {
        feedContainer.value.addEventListener('wheel', handleWheel, { passive: false })
    }
})

onUnmounted(() => {
    // Clean up event listener
    if (feedContainer.value) {
        feedContainer.value.removeEventListener('wheel', handleWheel)
    }
})

const handleProfileCreated = () => {
    showProfileModal.value = false
}

// --- Modal States ---
// We use a simple state machine: only one major overlay active at a time
const showMap = ref(false)
const showSearch = ref(false)
const showProfile = ref(false)
const selectedMapEvent = ref(null) // Event selected on map
const selectedOrganizer = ref(null) // For Organizer Profile Modal

const openOrganizerProfile = (name) => {
    selectedOrganizer.value = name
}

const activeTab = computed({
    get: () => {
        if (showMap.value) return 'map'
        if (showSearch.value) return 'search'
        if (showProfile.value) return 'profile'
        return 'feed'
    },
    set: (val) => {
        // Reset all
        showMap.value = false
        showSearch.value = false
        showProfile.value = false
        
        if (val === 'map') showMap.value = true
        if (val === 'search') showSearch.value = true
        if (val === 'profile') showProfile.value = true
    }
})

// --- Map Logic ---
const mapContainer = ref(null)
let mapInstance = null
let routeLayer = null
let userMarker = null
const showRouteInfo = ref(false)
const routeInfo = ref({ distance: '', duration: '' })

// Inject Leaflet CSS & Listeners
onMounted(() => {
    // Theme Init
    if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        isDarkMode.value = true
        document.documentElement.classList.add('dark')
    } else {
        isDarkMode.value = false
        document.documentElement.classList.remove('dark')
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    // Listen for Map Popup Clicks
    document.addEventListener('map-event-click', (e) => {
        const eventId = e.detail
        const event = eventStore.events.find(ev => ev.id == eventId) // Loose equality for string/number match
        if (event) {
            selectedMapEvent.value = event
        }
    })
})

watch(showMap, async (isOpen) => {
    if (isOpen) {
        await nextTick()
        initMap()
        // If an event is selected (e.g. from Itinerary click), fly to it
        if (selectedMapEvent.value && mapInstance) {
            mapInstance.setView([selectedMapEvent.value.coords.lat, selectedMapEvent.value.coords.lng], 16)
        }
    } else {
        if (mapInstance) {
            mapInstance.remove()
            mapInstance = null
        }
    }
})

const initMap = () => {
    if (mapInstance) mapInstance.remove() // Safety cleanup

    // Center on Abidjan (Marcory) or Selected Event
    const center = selectedMapEvent.value 
        ? [selectedMapEvent.value.coords.lat, selectedMapEvent.value.coords.lng] 
        : [5.30966, -3.97449]

    mapInstance = L.map(mapContainer.value).setView(center, selectedMapEvent.value ? 16 : 14)

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(mapInstance)

    // Add Markers from Store
    let markerCount = 0
    eventStore.events.forEach(event => {
        if (event.coords) {
            markerCount++
            const marker = L.marker([event.coords.lat, event.coords.lng]).addTo(mapInstance)
            
            // Custom Popup
            const popupContent = `
                <div class="text-black text-center">
                    <img src="${event.image}" style="width:100%; height:80px; object-fit:cover; border-radius:4px; margin-bottom:4px">
                    <div style="font-weight:bold; font-size:12px">${event.title}</div>
                    <div style="font-size:10px; color:gray">${event.distance}</div>
                    <button onclick="document.dispatchEvent(new CustomEvent('map-event-click', {detail: '${event.id}'}))" style="background:#00f2ea; border:none; padding:4px 8px; border-radius:10px; font-size:10px; margin-top:4px; cursor:pointer">Voir</button>
                </div>
            `
            marker.bindPopup(popupContent)
        }
    })
    
    console.log(`📍 ${markerCount} événements affichés sur la carte sur ${eventStore.events.length} total`)
}


// --- Search Logic ---
const searchQuery = ref('')
const showPremiumOnly = ref(false)

const filteredEvents = computed(() => {
    let results = eventStore.events
    
    // Filter by premium if toggle is on
    if (showPremiumOnly.value) {
        results = results.filter(e => e.isPremium)
    }
    
    // Filter by search query
    if (searchQuery.value) {
        results = results.filter(e => 
            e.title.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
            e.description.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
            e.location.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
            e.organizer.toLowerCase().includes(searchQuery.value.toLowerCase())
        )
    }
    
    return results
})

const handleSearchSelect = (event) => {
    // Scroll to event or just show it (for MVP just close search)
    activeTab.value = 'feed'
    // In a real app we would scroll to the specific slide
}

// --- Profile Logic ---
const myEvents = computed(() => {
    return eventStore.events.filter(e => e.isRegistered)
})


const handleJyVais = async (event) => {
    if (!userStore.user) {
        showProfileModal.value = true
        return
    }

    // Toggle registration state persistent
    if (!event.isRegistered) {
        eventStore.updateEvent(event.id, {
            isRegistered: true,
            participantCount: event.participantCount + 1
        })
        messageSuccess.value = `✅ Inscription confirmée !`
        
        // Send WhatsApp Notification
        if (userStore.user && userStore.user.phone) {
            sendingMessage.value = true
            try {
                // Determine user name
                const userName = userStore.user.name || 'Utilisateur'
                await sendEventNotification(event, userName, userStore.user.phone)
                messageSuccess.value = `✅ Inscription confirmée ! Notification envoyée 📱`
            } catch (err) {
                console.error('Notification failed', err)
                // Don't block UI for this, but maybe show warning?
            } finally {
                sendingMessage.value = false
            }
        }
        
    } else {
        // Toggle off
        eventStore.updateEvent(event.id, {
            isRegistered: false,
            participantCount: Math.max(0, event.participantCount - 1)
        })
        messageSuccess.value = `Inscription annulée.`
    }
    
    // Clear success message after 3 seconds
    setTimeout(() => {
        messageSuccess.value = ''
    }, 3000)
}

const handleItinerary = async (event) => {
    selectedMapEvent.value = event
    showMap.value = true
}

const sendItineraryWhatsApp = async (event) => {
     if (!userStore.user || !userStore.user.phone) {
        showProfileModal.value = true
        return
     }

     messageSuccess.value = 'Envoi de l\'itinéraire sur WhatsApp...'
     // ... code for whatsapp ...
     try {
        await sendWhatsAppLocation(
            userStore.user.phone,
            event.coords.lat,
            event.coords.lng,
            event.title,
            event.location
        )
        messageSuccess.value = '✅ Itinéraire envoyé sur WhatsApp ! 🗺️'
    } catch (err) {
        console.error('Failed to send location', err)
        messageError.value = 'Erreur lors de l\'envoi de l\'itinéraire.'
        setTimeout(() => messageError.value = '', 3000)
    } finally {
        setTimeout(() => messageSuccess.value = '', 3000)
    }
}

const openMap = (location) => {
    // Open Google Maps with the location query
    const query = encodeURIComponent(location)
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
}

const handleShare = async (event) => {
    try {
        if (navigator.share) {
            await navigator.share({
                title: event.title,
                text: `Viens on va là-bas : ${event.title} à ${event.location} ! 🚀 #BabiVibes`,
                url: window.location.href
            })
        } else {
            // Fallback
            await navigator.clipboard.writeText(`Viens on va là-bas : ${event.title} à ${event.location} ! 🚀`)
            messageSuccess.value = "Lien copié !"
            setTimeout(() => messageSuccess.value = '', 3000)
        }
    } catch (err) {
        console.log('Share canceled', err)
    }
}

// --- Theme Logic ---
const isDarkMode = ref(true)
const toggleTheme = () => {
    isDarkMode.value = !isDarkMode.value
    if (isDarkMode.value) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
    } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
    }
}
</script>

<template>
  <div class="responsive-container bg-black text-white relative overflow-hidden">
    <!-- Header (Floating) -->
    <!-- Header (Standard TikTok Style) -->
    <div class="header-tabs absolute top-0 w-full z-20 pt-14 pb-4 bg-gradient-to-b from-black/80 to-transparent flex justify-center items-center gap-6 text-white font-bold drop-shadow-md pointer-events-auto transition-all duration-300">
       <div class="flex items-center gap-4">
            <button 
                @click="activeTab = 'map'"
                class="text-white/80 hover:text-white transition transform active:scale-95 flex flex-col items-center">
                <MapIcon class="w-6 h-6" />
                <span class="text-[10px] font-normal">Carte</span>
            </button>
            <div class="text-white text-xl font-bold border-b-2 border-primary pb-0.5 shadow-lg">
                BABI VIBES ✨
            </div>
       </div>
    </div>

    <!-- MAIN FEED VIEW -->
    <div ref="feedContainer" class="feed-container snap-y snap-mandatory h-screen w-full overflow-y-scroll scroll-smooth no-scrollbar">
      <template v-for="item in feedItems" :key="item.type === 'event' ? item.data.id : item.data.id">
        <!-- AD SLIDE -->
        <AdBanner v-if="item.type === 'ad'" :ad="item.data" />

        <!-- EVENT SLIDE -->
        <div v-else class="event-slide snap-start h-screen w-full relative bg-dark-lighter flex items-end shrink-0">

        <!-- Background Image/Video -->
        <!-- Added transition for image loading feel -->
        <div class="absolute inset-0 bg-gray-900">
           <video v-if="item.data.type === 'video'" :src="item.data.video" autoplay loop muted playsinline class="w-full h-full object-cover opacity-100"></video>
           <img v-else :src="item.data.image" alt="Event Cover" class="w-full h-full object-cover opacity-90" />
           <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90"></div>
        </div>

        <!-- Premium Badge (Top Left) -->
        <div v-if="item.data.isPremium" class="absolute top-20 left-4 z-20">
            <div class="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-lg">
                <Crown class="w-4 h-4" />
                <span>PREMIUM</span>
            </div>
        </div>
        
        <!-- Right Side Actions (Floating properly aligned) -->
        <div class="action-buttons absolute right-2 bottom-28 flex flex-col gap-6 z-20 items-center">
           <!-- Profile/Organizer Avatar (TikTok style) -->
           <div class="relative mb-2 cursor-pointer" @click="openOrganizerProfile(item.data.organizer)">
             <div class="w-12 h-12 rounded-full border-2 border-primary overflow-hidden p-0.5">
               <img :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.data.organizer}`" class="w-full h-full rounded-full bg-white" />
             </div>
             <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-primary rounded-full w-5 h-5 flex items-center justify-center border border-black">
               <span class="text-black text-xs font-bold">+</span>
             </div>
           </div>

            <button
              @click="handleJyVais(item.data)"
              class="action-button flex flex-col items-center gap-1 group">
              <div class="relative">
                <Heart
                    class="w-9 h-9 transition-transform duration-200"
                    :class="item.data.isRegistered ? 'fill-green-500 text-green-500 scale-110' : 'text-white fill-white/10 group-active:scale-75'"
                />
              </div>
              <span class="action-button-text text-xs font-semibold drop-shadow-md">
                {{ item.data.isRegistered ? 'Inscrit' : `J'y vais` }}
              </span>
              <span class="text-[10px] font-bold">{{ item.data.participantCount }}</span>
            </button>

            <button @click="openMap(item.data.location)" class="action-button flex flex-col items-center gap-1 group">
              <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-active:scale-90 transition">
                 <MapPin class="w-6 h-6 text-white"/>
              </div>
              <span class="action-button-text text-xs font-semibold drop-shadow-md">Map</span>
            </button>

           <button @click="handleShare(item.data)" class="action-button flex flex-col items-center gap-1 group">
             <div class="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center group-active:scale-90 transition">
                <Share2 class="w-6 h-6 text-white"/>
             </div>
             <span class="action-button-text text-xs font-semibold drop-shadow-md">Partager</span>
           </button>

           <!-- Spinning Disc (TikTok Vibe) -->
           <div class="mt-4 relative">
              <div class="w-12 h-12 rounded-full bg-black border-[3px] border-dark-lighter flex items-center justify-center animate-spin-slow overflow-hidden">
                 <img :src="item.data.image" class="w-full h-full object-cover opacity-80" />
              </div>
              <!-- Floating Notes Animation would go here -->
           </div>
        </div>

        <!-- Content Overlay (Bottom Left) -->
        <!-- mb-20 to clear the bottom navigation -->
        <div class="event-content relative z-10 w-full pl-4 pr-16 pb-4 mb-20 flex flex-col items-start space-y-2 pointer-events-none">
          <!-- Promo Label -->
          <div v-if="!item.data.isPremium" class="animate-pulse bg-secondary/90 backdrop-blur-md text-white px-3 py-1 rounded-r-full rounded-tl-full text-sm font-black uppercase tracking-wider shadow-lg transform -rotate-1 origin-bottom-left inline-block">
            🔥 2 achetées = 1 offerte
          </div>

          <!-- Premium Price Tag -->
          <div v-else class="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-1.5 rounded-r-full rounded-tl-full text-sm font-black uppercase tracking-wider shadow-lg inline-flex items-center gap-2">
            <Crown class="w-4 h-4" />
            <span>{{ item.data.price?.toLocaleString() }} CFA</span>
          </div>

          <div class="max-w-[85%]">
            <h2 class="text-2xl font-bold leading-tight mb-1 text-white text-shadow">{{ item.data.title }}</h2>
            <div class="flex items-center text-gray-200 font-medium text-sm gap-2">
                <span class="flex items-center text-primary"><MapPin class="w-4 h-4 mr-0.5"/> {{ item.data.location }}</span>
                <span class="text-gray-400">•</span>
                <span class="text-gray-300">{{ item.data.distance }}</span>
            </div>
          </div>

          <!-- Collapsed Description (TikTok style) -->
          <p class="text-gray-200 text-sm line-clamp-2 w-[85%] leading-relaxed opacity-90 mb-2">
            {{ item.data.description || 'Découvrez cet événement incontournable!' }}
          </p>

          <!-- Premium Features -->
          <div v-if="item.data.isPremium && item.data.features?.length" class="flex flex-wrap gap-1.5 w-[85%]">
            <span v-for="feature in item.data.features" :key="feature" class="bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium">
                ✨ {{ feature }}
            </span>
          </div>

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
      </template>
    </div>

    <!-- MAP MODAL (Full Screen Popup) -->
    <transition name="fade">
        <div v-if="showMap" class="fixed inset-0 bg-black z-50 flex flex-col">
            <!-- Modal Header -->
            <div class="absolute top-0 left-0 right-0 z-[1000] p-4 pt-12 flex justify-between items-center bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
                <h2 class="text-xl font-bold text-white pl-2 pointer-events-auto">Autour de moi 🌍</h2>
                <button @click="showMap = false" class="bg-black/50 backdrop-blur-md p-2 rounded-full text-white pointer-events-auto hover:bg-white/20 transition">
                    <X class="w-6 h-6" />
                </button>
            </div>

            <!-- Map Container -->
            <div ref="mapContainer" class="w-full h-full relative z-10"></div>
            
             <!-- Floating Info (Hide if event is selected) -->
            <div v-if="!selectedMapEvent" class="absolute bottom-10 left-4 right-4 z-[500] bg-black/80 backdrop-blur-md p-3 rounded-xl border border-white/10 pointer-events-none">
                <p class="text-white text-center text-xs">Déplacez-vous sur la carte pour voir les événements.</p>
            </div>

            <!-- EVENT DETAIL SIDEBAR (Bottom Sheet) -->
            <transition name="up">
                <div v-if="selectedMapEvent" class="absolute bottom-0 left-0 right-0 z-[600] bg-gray-900 rounded-t-3xl border-t border-gray-700 shadow-2xl max-h-[85vh] overflow-y-auto flex flex-col">
                    
                    <!-- Cover Image -->
                    <div class="relative h-48 w-full shrink-0">
                        <img :src="selectedMapEvent.image" class="w-full h-full object-cover">
                        <button @click="selectedMapEvent = null" class="absolute top-4 right-4 bg-black/50 p-2 rounded-full text-white backdrop-blur-sm">
                            <X class="w-5 h-5" />
                        </button>
                        <div class="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent"></div>
                    </div>

                    <!-- Content -->
                    <div class="p-6 -mt-6 relative">
                         <!-- Badge -->
                        <span class="bg-primary text-black text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
                             {{ selectedMapEvent.type === 'video' ? 'Ambiance' : 'Événement' }}
                        </span>

                        <h2 class="text-2xl font-bold text-white mb-1 leading-tight">{{ selectedMapEvent.title }}</h2>
                        <p class="text-gray-400 text-sm mb-4 flex items-center gap-1">
                             <MapPin class="w-4 h-4 text-primary" /> 
                             {{ selectedMapEvent.location }} ({{ selectedMapEvent.distance }})
                        </p>

                        <div class="flex items-center gap-4 mb-6 text-sm text-gray-300 bg-black/30 p-3 rounded-lg">
                            <div class="flex items-center gap-2">
                                <Calendar class="w-4 h-4 text-gray-400"/>
                                <span>{{ new Date(selectedMapEvent.date).toLocaleDateString() }}</span>
                            </div>
                            <div class="w-[1px] h-4 bg-gray-600"></div>
                            <div class="flex items-center gap-2">
                                <UserCircle class="w-4 h-4 text-gray-400"/>
                                <span>{{ selectedMapEvent.organizer }}</span>
                            </div>
                        </div>

                        <p class="text-gray-300 text-sm leading-relaxed mb-8">
                            {{ selectedMapEvent.description }}
                        </p>

                        <!-- COMMANDS / ACTIONS -->
                        <div class="grid grid-cols-2 gap-3 pb-4">
                            <button 
                                @click="handleJyVais(selectedMapEvent)"
                                class="flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition active:scale-95"
                                :class="selectedMapEvent.isRegistered ? 'bg-green-600 text-white' : 'bg-primary text-black'"
                            >
                                <Heart class="w-5 h-5" :class="{'fill-white': selectedMapEvent.isRegistered}" />
                                {{ selectedMapEvent.isRegistered ? 'Inscrit' : "J'y vais" }}
                            </button>

                            <button 
                                @click="handleItinerary(selectedMapEvent)"
                                class="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-700 text-white font-bold hover:bg-gray-600 transition active:scale-95"
                            >
                                <MapIcon class="w-5 h-5" />
                                Voir sur la Carte
                            </button>
                            
                            <button 
                                @click="sendItineraryWhatsApp(selectedMapEvent)"
                                class="col-span-2 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600/20 text-green-500 font-bold hover:bg-green-600/30 transition active:scale-95 border border-green-600/50 mt-2"
                            >
                                🗺️ Envoyer sur WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            </transition>
        </div>
    </transition>

    <!-- SEARCH MODAL -->
    <transition name="fade">
        <div v-if="showSearch" class="fixed inset-0 bg-gray-50 dark:bg-black/95 dark:backdrop-blur-xl z-50 flex flex-col pt-12 px-4 transition-colors duration-300">
             <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">Recherche</h2>
                <button @click="showSearch = false" class="text-gray-900 dark:text-white p-2"><X class="w-7 h-7" /></button>
            </div>

            <div class="relative mb-4">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Chercher un artiste, un lieu..." 
                    class="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-transparent rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    autofocus
                >
            </div>

            <!-- Premium Filter Toggle -->
            <div class="mb-6">
                <button 
                    @click="showPremiumOnly = !showPremiumOnly"
                    class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                    :class="showPremiumOnly 
                        ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-lg' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'"
                >
                    <Crown class="w-4 h-4" />
                    <span>{{ showPremiumOnly ? 'Tous les événements' : 'Événements Premium uniquement' }}</span>
                </button>
            </div>

            <div class="flex-1 overflow-y-auto">
                <div v-if="filteredEvents.length === 0" class="text-center text-gray-500 mt-10">
                    {{ searchQuery ? 'Aucun résultat trouvé 😢' : 'Commencez à taper pour rechercher...' }}
                </div>
                
                <div class="grid grid-cols-2 gap-4 pb-20">
                    <div v-for="event in (searchQuery || showPremiumOnly ? filteredEvents : eventStore.events)" :key="event.id" 
                         @click="handleSearchSelect(event)"
                         class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden active:scale-95 transition cursor-pointer shadow-md dark:shadow-none relative">
                        <div class="relative">
                            <img :src="event.image" class="w-full h-32 object-cover">
                            <!-- Premium Badge on Image -->
                            <div v-if="event.isPremium" class="absolute top-2 right-2">
                                <div class="bg-gradient-to-r from-yellow-400 to-amber-500 p-1 rounded-full shadow-lg">
                                    <Crown class="w-3 h-3 text-black" />
                                </div>
                            </div>
                        </div>
                        <div class="p-2">
                            <div class="flex items-center gap-1 mb-1">
                                <h3 class="font-bold text-sm truncate text-gray-900 dark:text-white flex-1">{{ event.title }}</h3>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ new Date(event.date).toLocaleDateString('fr-FR') }}</p>
                            <div v-if="event.isPremium" class="text-xs font-bold text-amber-500">
                                {{ event.price?.toLocaleString() }} CFA
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </transition>

    <!-- PROFILE MODAL (Calendar & Create) -->
    <transition name="up">
        <div v-if="showProfile" class="fixed inset-0 bg-gray-50 dark:bg-black z-50 flex flex-col pt-10 overflow-y-auto transition-colors duration-300">
             <!-- Header -->
             <div class="px-6 py-4 flex justify-between items-end border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-black/80 backdrop-blur-md sticky top-0 z-10 transition-colors duration-300">
                <div>
                    <h1 class="text-3xl font-black italic tracking-tighter text-gray-900 dark:text-white">MON PROFIL</h1>
                    <p class="text-primary text-sm font-medium">{{ userStore.user?.name || 'Visiteur' }}</p>
                </div>
                <button @click="toggleTheme" class="bg-gray-200 dark:bg-gray-800 p-2 rounded-full text-black dark:text-white transition">
                    <Moon v-if="!(isDarkMode)" class="w-6 h-6" />
                    <Sun v-else class="w-6 h-6" />
                </button>
            </div>

            <div class="p-6 pb-32">
                 <!-- Create Action -->
                 <div class="bg-gradient-to-r from-primary to-purple-600 rounded-2xl p-4 mb-8 text-black flex items-center justify-between shadow-lg shadow-primary/20 cursor-pointer hover:scale-[1.02] transition">
                    <div>
                        <h3 class="font-bold text-lg">Organiser un événement</h3>
                        <p class="text-xs opacity-80">Devenir un créateur</p>
                    </div>
                    <div class="bg-black/20 p-2 rounded-full">
                        <Plus class="w-6 h-6 text-black" />
                    </div>
                 </div>

                 <!-- Calendar Section -->
                 <div class="mb-4 flex items-center gap-2">
                    <Calendar class="w-5 h-5 text-primary" />
                    <h3 class="font-bold text-xl text-gray-900 dark:text-white">Mes Sorties ({{ myEvents.length }})</h3>
                 </div>

                 <div v-if="myEvents.length === 0" class="text-center py-10 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 shadow-sm">
                    <p class="text-gray-500 mb-2">Pas encore d'événements prévus.</p>
                    <button @click="activeTab = 'feed'" class="text-primary text-sm font-bold underline">Explorer le feed</button>
                 </div>

                 <div v-else class="space-y-4">
                    <div v-for="event in myEvents" :key="event.id" class="flex gap-4 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300">
                        <div class="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-800 flex-shrink-0 overflow-hidden">
                            <img :src="event.image" class="w-full h-full object-cover">
                        </div>
                        <div class="flex-1">
                            <h4 class="font-bold text-gray-900 dark:text-white line-clamp-1">{{ event.title }}</h4>
                            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span>📅 {{ new Date(event.date).toLocaleDateString() }}</span>
                                <span>📍 {{ event.location.split(',')[0] }}</span>
                            </div>
                            <span class="inline-block mt-2 text-[10px] bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-bold">Confirmé</span>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    </transition>
    
    <!-- Simple Bottom Navigation (Home, Recherche, Carte, Profil) -->
    <div class="bottom-nav fixed bottom-0 w-full z-50 bg-white dark:bg-black text-gray-900 dark:text-white flex justify-around items-center h-16 border-t border-gray-200 dark:border-white/10 pb-safe transition-colors duration-300">
        <button 
            @click="activeTab = 'feed'"
            class="flex flex-col items-center gap-1 transition"
            :class="!showSearch && !showProfile && !showMap ? 'opacity-100 text-primary scale-110' : 'opacity-40 hover:opacity-100'"
        >
           <Home class="w-6 h-6" />
           <span class="text-[10px] font-bold">Home</span>
        </button>
        
        <button 
            @click="activeTab = 'search'"
            class="flex flex-col items-center gap-1 transition"
            :class="showSearch ? 'opacity-100 text-primary scale-110' : 'opacity-40 hover:opacity-100'"
        >
           <Search class="w-6 h-6" />
           <span class="text-[10px] font-bold">Recherche</span>
        </button>

        <button 
            @click="activeTab = 'map'"
            class="flex flex-col items-center gap-1 transition"
            :class="showMap ? 'opacity-100 text-primary scale-110' : 'opacity-40 hover:opacity-100'"
        >
           <MapIcon class="w-6 h-6" />
           <span class="text-[10px] font-bold">Carte</span>
        </button>

        <button 
            @click="activeTab = 'profile'"
            class="flex flex-col items-center gap-1 transition"
            :class="showProfile ? 'opacity-100 text-primary scale-110' : 'opacity-40 hover:opacity-100'"
        >
           <UserCircle class="w-6 h-6" />
           <span class="text-[10px] font-bold">Profil</span>
        </button>
    </div>

    <!-- User Profile Modal -->
    <UserProfileModal v-if="showProfileModal" @profile-created="handleProfileCreated" />

    <!-- Organizer Profile Modal -->
    <transition name="up">
        <OrganizerProfile 
            v-if="selectedOrganizer" 
            :organizer-name="selectedOrganizer" 
            @close="selectedOrganizer = null" 
        />
    </transition>
    
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
    <!-- Location Toast Recommendation -->
    <Transition
        enter-active-class="transform ease-out duration-300 transition"
        enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
        enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
    >
        <div v-if="showToast && toastEvent" class="fixed top-4 left-4 right-4 z-50 bg-gray-900 border border-primary text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 cursor-pointer" @click="scrollToEvent(toastEvent.id)">
            <div class="bg-primary/20 p-2 rounded-full">
                <MapPin class="w-6 h-6 text-primary" />
            </div>
            <div class="flex-1">
                <p class="text-xs text-gray-400">À proximité ({{ getDistanceFromLatLonInKm(coords.latitude, coords.longitude, toastEvent.coords.lat, toastEvent.coords.lng).toFixed(1) }} km)</p>
                <p class="font-bold text-sm">"{{ toastEvent.title }}" commence bientôt !</p>
                <p class="text-xs text-primary font-bold">J'y vais ? 👉</p>
            </div>
            <button @click.stop="showToast = false" class="text-gray-500 hover:text-white">✕</button>
        </div>
    </Transition>

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

/* Translation Up Animation */
.up-enter-active, .up-leave-active {
  transition: transform 0.3s ease-in-out;
}
.up-enter-from, .up-leave-to {
  transform: translateY(100%);
}
</style>
