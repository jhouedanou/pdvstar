<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { useAdminStore } from '../stores/adminStore'
import { useGeolocation } from '@vueuse/core'
import { Heart, MapPin, Share2, Loader, Search, UserCircle, Home, X, Calendar, Plus, Map as MapIcon, Sun, Moon, Crown, Edit, Trash2, Check, Store, Volume2, VolumeX, Shield, LogIn } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import UserProfileModal from '../components/UserProfileModal.vue'
import OrganizerProfile from '../components/OrganizerProfile.vue'
import AdBanner from '../components/AdBanner.vue'
import L from 'leaflet'
// import RotateDeviceMessage from '../components/RotateDeviceMessage.vue' // Décommenter pour activer le message de rotation
import { sendEventNotification, sendWhatsAppLocation } from '../services/greenApiService'
import { db } from '../services/db'
import { fetchActiveAds } from '../services/supabase'

const eventStore = useEventStore()
const userStore = useUserStore()
const adminStore = useAdminStore()
const router = useRouter()

const showProfileModal = ref(false)
const sendingMessage = ref(false)
const messageError = ref('')
const messageSuccess = ref('')
const { coords, resume } = useGeolocation()

// Get Ads from Supabase (fallback to local DB)
const ads = ref(db.getAds())

// Current visible slide index (for YouTube autoplay control)
const currentSlideIndex = ref(0)

// Mute state for current event music (son activé par défaut)
const isMuted = ref(false)

// Splash screen : simule la première interaction pour débloquer l'autoplay audio
const hasInteracted = ref(false)

const enterApp = () => {
    hasInteracted.value = true
    // Petit délai pour laisser le DOM charger les iframes avant de lancer la lecture
    setTimeout(() => syncYouTubePlayback(), 500)
}

// Mix events and ads (every 5 events, insert an ad)
const feedItems = computed(() => {
    const items = []
    const now = new Date()
    // Filtrer les events à venir et trier du plus loin à venir au plus proche
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // début de journée
    const upcomingEvents = [...eventStore.events]
        .filter(e => {
            if (!e.date) return false // exclure les events sans date
            return new Date(e.date) >= today
        })
        .sort((a, b) => {
            const dateA = new Date(a.date || 0)
            const dateB = new Date(b.date || 0)
            return dateB - dateA
        })
    const adsList = ads.value

    upcomingEvents.forEach((event, index) => {
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

const scrollToEvent = async (id) => {
    showToast.value = false

    // Find the event
    const event = eventStore.events.find(e => e.id === id)

    // Auto-register if not already registered
    if (event && !event.isRegistered) {
        await handleJyVais(event)
    }

    // Make sure we're on feed tab
    if (showMap.value || showSearch.value || showProfile.value) {
        activeTab.value = 'feed'
    }

    // Wait for next tick to ensure DOM is updated
    nextTick(() => {
        // Find the index of the event in feedItems
        const eventIndex = feedItems.value.findIndex(item =>
            item.type === 'event' && item.data.id === id
        )

        if (eventIndex !== -1 && feedContainer.value) {
            // Scroll to the event (each slide is 100vh)
            const slideHeight = window.innerHeight
            const targetScroll = eventIndex * slideHeight

            feedContainer.value.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            })
        }
    })
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

onMounted(async () => {
    // Charger les événements depuis Supabase
    await eventStore.loadEvents()

    // Charger les publicités depuis Supabase
    try {
        const supaAds = await fetchActiveAds()
        if (supaAds.length > 0) {
            ads.value = supaAds
        }
    } catch (e) {
        console.warn('Ads Supabase fallback local:', e)
    }

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
        // Détecter la slide courante au scroll (pour stopper YouTube)
        feedContainer.value.addEventListener('scroll', handleFeedScroll, { passive: true })
    }

    // La première slide a autoplay=1, les autres autoplay=0
    // syncYouTubePlayback sera appelé au scroll pour gérer les transitions
})

onUnmounted(() => {
    // Clean up event listener
    if (feedContainer.value) {
        feedContainer.value.removeEventListener('wheel', handleWheel)
        feedContainer.value.removeEventListener('scroll', handleFeedScroll)
    }
})

// Contrôle YouTube : src swap pour play/pause + postMessage pour mute
const postYouTubeCommand = (iframe, func) => {
    try {
        iframe.contentWindow.postMessage(JSON.stringify({
            event: 'command', func, args: ''
        }), '*')
    } catch (e) { /* cross-origin silencieux */ }
}

const syncYouTubePlayback = () => {
    if (!feedContainer.value) return
    const slides = feedContainer.value.querySelectorAll('.event-slide')
    slides.forEach((slide, idx) => {
        const iframes = slide.querySelectorAll('iframe[src*="youtube"]')
        iframes.forEach(iframe => {
            if (idx === currentSlideIndex.value) {
                // Jouer la slide courante via postMessage (instant, pas de reload)
                postYouTubeCommand(iframe, 'playVideo')
                postYouTubeCommand(iframe, isMuted.value ? 'mute' : 'unMute')
            } else {
                // Pause les autres slides
                postYouTubeCommand(iframe, 'pauseVideo')
            }
        })
    })
}

const handleFeedScroll = () => {
    if (!feedContainer.value) return
    const slideHeight = feedContainer.value.clientHeight
    const newIndex = Math.round(feedContainer.value.scrollTop / slideHeight)
    
    if (newIndex !== currentSlideIndex.value) {
        currentSlideIndex.value = newIndex
        syncYouTubePlayback()
    }
}

// Toggle mute/unmute pour l'event actuel (via postMessage — fiable pour mute)
const toggleMute = () => {
    isMuted.value = !isMuted.value
    if (!feedContainer.value) return
    const slides = feedContainer.value.querySelectorAll('.event-slide')
    const currentSlide = slides[currentSlideIndex.value]
    if (!currentSlide) return
    const iframes = currentSlide.querySelectorAll('iframe[src*="youtube"]')
    iframes.forEach(iframe => {
        // postMessage pour mute/unmute instantané (pas de reload iframe)
        postYouTubeCommand(iframe, isMuted.value ? 'mute' : 'unMute')
    })
}

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
const showGoogleMapsModal = ref(false)
const googleMapsLocation = ref('')

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
        // Si on quitte le feed, couper toutes les musiques YouTube
        const wasFeed = !showMap.value && !showSearch.value && !showProfile.value
        
        // Reset all
        showMap.value = false
        showSearch.value = false
        showProfile.value = false
        
        if (val === 'map') showMap.value = true
        if (val === 'search') showSearch.value = true
        if (val === 'profile') showProfile.value = true

        // Pause YouTube quand on quitte le feed
        if (wasFeed && val !== 'feed') {
            pauseAllYouTube()
        }
        // Reprendre la musique quand on revient au feed
        if (val === 'feed') {
            setTimeout(() => syncYouTubePlayback(), 300)
        }
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

    // Add user location marker if available
    if (coords.value.latitude !== Infinity) {
        const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: `<div style="background: #00f2ea; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,242,234,0.5);"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        })

        userMarker = L.marker([coords.value.latitude, coords.value.longitude], { icon: userIcon })
            .addTo(mapInstance)
            .bindPopup('<div class="text-black text-center font-bold text-xs">📍 Vous êtes ici</div>')
    }

    // Add Markers from Store
    let markerCount = 0
    eventStore.events.forEach(event => {
        if (event.coords) {
            markerCount++

            // Custom icon for events
            const eventIcon = L.divIcon({
                className: 'event-marker',
                html: `<div style="background: #FFD700; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">🎉</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            })

            const marker = L.marker([event.coords.lat, event.coords.lng], { icon: eventIcon }).addTo(mapInstance)

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

    // If event is selected and user location is available, show route
    if (selectedMapEvent.value && selectedMapEvent.value.coords && coords.value.latitude !== Infinity) {
        drawRoute(coords.value.latitude, coords.value.longitude, selectedMapEvent.value.coords.lat, selectedMapEvent.value.coords.lng)
    }
}

const drawRoute = async (fromLat, fromLng, toLat, toLng) => {
    try {
        // Remove existing route
        if (routeLayer) {
            mapInstance.removeLayer(routeLayer)
        }

        // Call OSRM API for routing
        const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
        )
        const data = await response.json()

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0]

            // Draw route on map
            routeLayer = L.geoJSON(route.geometry, {
                style: {
                    color: '#00f2ea',
                    weight: 4,
                    opacity: 0.8
                }
            }).addTo(mapInstance)

            // Fit map to show entire route
            mapInstance.fitBounds(routeLayer.getBounds(), { padding: [50, 50] })

            // Update route info
            const distanceKm = (route.distance / 1000).toFixed(1)
            const durationMin = Math.round(route.duration / 60)
            routeInfo.value = {
                distance: `${distanceKm} km`,
                duration: `${durationMin} min`
            }
            showRouteInfo.value = true
        }
    } catch (error) {
        console.error('Error fetching route:', error)
    }
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
        await eventStore.updateEvent(event.id, {
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
        await eventStore.updateEvent(event.id, {
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
    // Route will be drawn automatically in initMap when map opens
}

const toggleRoute = () => {
    if (!selectedMapEvent.value || !selectedMapEvent.value.coords || coords.value.latitude === Infinity) {
        return
    }

    if (routeLayer && mapInstance.hasLayer(routeLayer)) {
        // Hide route
        mapInstance.removeLayer(routeLayer)
        showRouteInfo.value = false
    } else {
        // Show route
        drawRoute(coords.value.latitude, coords.value.longitude, selectedMapEvent.value.coords.lat, selectedMapEvent.value.coords.lng)
    }
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

const openMap = (location, event = null) => {
    // Open Google Maps in modal instead of new window
    googleMapsLocation.value = location

    // If event is provided, set it as selected for potential use
    if (event) {
        selectedMapEvent.value = event
    }

    showGoogleMapsModal.value = true
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

// --- YouTube Helper ---
/**
 * Extraire l'ID d'une vidéo YouTube depuis une URL
 * Supporte: youtube.com/watch?v=, youtu.be/, youtube.com/embed/
 */
const getYouTubeId = (url) => {
    if (!url) return null
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ // ID brut
    ]
    for (const pattern of patterns) {
        const match = url.match(pattern)
        if (match) return match[1]
    }
    return null
}

// --- Window helpers (non accessible dans le template Vue) ---
const appOrigin = typeof window !== 'undefined' ? window.location.origin : ''

const openExternalMap = (location) => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank')
}

// Pause all YouTube iframes (used when leaving feed tab)
const pauseAllYouTube = () => {
    if (!feedContainer.value) return
    const iframes = feedContainer.value.querySelectorAll('iframe[src*="youtube"]')
    iframes.forEach(iframe => {
        postYouTubeCommand(iframe, 'pauseVideo')
    })
}

// --- Profile Edit Logic ---
const showProfileEdit = ref(false)
const profileEditForm = ref({
    name: '',
    email: '',
    phone: ''
})
const profileEditLoading = ref(false)
const profileEditSuccess = ref('')

const openProfileEdit = () => {
    if (userStore.user) {
        profileEditForm.value = {
            name: userStore.user.name || '',
            email: userStore.user.email || '',
            phone: userStore.user.phone || ''
        }
    }
    showProfileEdit.value = true
}

const saveProfileEdit = async () => {
    profileEditLoading.value = true
    profileEditSuccess.value = ''
    try {
        await userStore.updateProfile({
            name: profileEditForm.value.name,
            email: profileEditForm.value.email
        })
        profileEditSuccess.value = '✅ Profil mis à jour !'
        setTimeout(() => {
            profileEditSuccess.value = ''
            showProfileEdit.value = false
        }, 1500)
    } catch (e) {
        console.error('Erreur update profil:', e)
    } finally {
        profileEditLoading.value = false
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

// ============================
// Organizer Logic
// ============================
const showOrganizerForm = ref(false)
const organizerForm = ref({
    organizerName: '',
    spaceName: ''
})
const organizerError = ref('')
const deleteConfirmId = ref(null)

const handleBecomeOrganizer = async () => {
    organizerError.value = ''
    if (!organizerForm.value.spaceName.trim()) {
        organizerError.value = 'Le nom de l\'espace est requis'
        return
    }
    if (!organizerForm.value.organizerName.trim()) {
        organizerError.value = 'Votre nom d\'organisateur est requis'
        return
    }

    const success = await userStore.becomeOrganizer({
        spaceName: organizerForm.value.spaceName,
        organizerName: organizerForm.value.organizerName
    })

    if (success) {
        showOrganizerForm.value = false
        messageSuccess.value = '🎉 Vous êtes maintenant organisateur ! Redirection...'
        setTimeout(() => {
            messageSuccess.value = ''
            router.push('/admin/dashboard')
        }, 1500)
    } else {
        organizerError.value = 'Erreur lors de l\'inscription'
    }
}

const myOrganizerEvents = computed(() => {
    if (!userStore.user || !userStore.isOrganizer) return []
    return eventStore.events
})

const handleDeleteEvent = async (eventId) => {
    await eventStore.deleteEvent(eventId)
    deleteConfirmId.value = null
    messageSuccess.value = '✅ Événement supprimé'
    setTimeout(() => messageSuccess.value = '', 3000)
}
</script>

<template>
  <div class="responsive-container bg-black text-white relative overflow-hidden">

    <!-- SPLASH SCREEN — débloque l'autoplay audio navigateur -->
    <Transition name="splash">
      <div 
        v-if="!hasInteracted"
        @click="enterApp"
        @touchstart.passive="enterApp"
        class="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center cursor-pointer select-none"
      >
        <div class="flex flex-col items-center gap-6 animate-pulse">
          <div class="text-6xl">🎉</div>
          <h1 class="text-4xl font-black text-primary tracking-tight">BABI VIBES</h1>
          <p class="text-gray-400 text-sm">La nightlife d'Abidjan à portée de main</p>
        </div>
        <div class="mt-12 flex flex-col items-center gap-3">
          <div class="bg-primary/20 border border-primary/40 text-primary px-8 py-3 rounded-full text-lg font-bold animate-bounce">
            👆 Toucher pour entrer
          </div>
          <p class="text-gray-600 text-xs mt-2">🎵 La musique sera activée</p>
        </div>
      </div>
    </Transition>

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
      <template v-for="(item, itemIndex) in feedItems" :key="item.type === 'event' ? item.data.id : item.data.id">
        <!-- AD SLIDE -->
        <AdBanner v-if="item.type === 'ad'" :ad="item.data" />

        <!-- EVENT SLIDE -->
        <div v-else class="event-slide snap-start h-screen w-full relative bg-dark-lighter flex items-end shrink-0">

        <!-- Background Image/Video -->
        <div class="absolute inset-0 bg-gray-900">
           <!-- Event image always visible -->
           <img :src="item.data.image" alt="Event Cover" class="w-full h-full object-cover opacity-90" />
           <!-- YouTube Background AUDIO (iframe chargé après interaction utilisateur) -->
           <iframe 
             v-if="hasInteracted && item.data.backgroundMusic && getYouTubeId(item.data.backgroundMusic)"
             :src="`https://www.youtube.com/embed/${getYouTubeId(item.data.backgroundMusic)}?autoplay=${itemIndex === 0 ? 1 : 0}&mute=${itemIndex === 0 ? 0 : 1}&loop=1&playlist=${getYouTubeId(item.data.backgroundMusic)}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(appOrigin)}`"
             class="absolute pointer-events-none"
             style="width:1px;height:1px;opacity:0;position:absolute;bottom:0;left:0;"
             frameborder="0"
             allow="autoplay; encrypted-media"
             :loading="itemIndex < 3 ? 'eager' : 'lazy'"
           ></iframe>
           <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black"></div>
           <div class="absolute bottom-0 left-0 right-0 h-[75%] bg-gradient-to-t from-black via-black/95 to-transparent"></div>
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

            <button @click="openMap(item.data.location, item.data)" class="action-button flex flex-col items-center gap-1 group">
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

           <!-- Mute / Unmute Button -->
           <button
             v-if="item.data.backgroundMusic && getYouTubeId(item.data.backgroundMusic)"
             @click="toggleMute"
             class="action-button flex flex-col items-center gap-1 group"
           >
             <div class="w-10 h-10 rounded-full backdrop-blur-sm flex items-center justify-center group-active:scale-90 transition"
                  :class="isMuted ? 'bg-red-500/30' : 'bg-primary/30'">
               <VolumeX v-if="isMuted" class="w-6 h-6 text-red-400" />
               <Volume2 v-else class="w-6 h-6 text-primary" />
             </div>
             <span class="action-button-text text-xs font-semibold drop-shadow-md">{{ isMuted ? 'Muet' : '🎵 Son' }}</span>
           </button>

           <!-- Spinning Disc (TikTok Vibe) -->
           <div class="mt-4 relative">
              <div class="w-12 h-12 rounded-full bg-black border-[3px] border-dark-lighter flex items-center justify-center overflow-hidden"
                   :class="(itemIndex === currentSlideIndex && !isMuted && item.data.backgroundMusic) ? 'animate-spin-slow' : ''">
                 <img :src="item.data.image" class="w-full h-full object-cover opacity-80" />
              </div>
              <!-- Floating Notes Animation would go here -->
           </div>
        </div>

        <!-- Content Overlay (Bottom Left) -->
        <!-- mb-20 to clear the bottom navigation -->
        <div class="event-content relative z-10 w-full pl-4 pr-16 pb-6 mb-20 flex flex-col items-start space-y-2.5 pointer-events-none">
          <!-- Promo Label (dynamique depuis la DB) -->
          <div v-if="item.data.promoText" class="animate-pulse bg-secondary/90 backdrop-blur-md text-white px-3 py-1 rounded-r-full rounded-tl-full text-sm font-black uppercase tracking-wider shadow-lg transform -rotate-1 origin-bottom-left inline-block">
            🔥 {{ item.data.promoText }}
          </div>

          <!-- Premium Price Tag -->
          <div v-if="item.data.isPremium" class="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-4 py-1.5 rounded-r-full rounded-tl-full text-sm font-black uppercase tracking-wider shadow-lg inline-flex items-center gap-2">
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

          <!-- Features Tags -->
          <div v-if="item.data.features?.length" class="flex flex-wrap gap-1.5 w-[85%]">
            <span v-for="feature in item.data.features" :key="feature" class="bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full font-medium">
                ✨ {{ feature }}
            </span>
          </div>

          <!-- Music Ticker -->
          <div class="music-ticker flex items-center gap-2 w-[70%] overflow-hidden pointer-events-auto">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 fill-white flex-shrink-0" :class="item.data.backgroundMusic ? 'animate-spin-slow' : 'animate-pulse'" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              <div class="whitespace-nowrap animate-marquee text-xs font-medium">
                  <span v-if="item.data.backgroundMusic" class="mr-4">🎵 {{ item.data.musicTitle || 'Musique de fond' }}</span>
                  <span v-if="item.data.backgroundMusic" class="mr-4">🎵 {{ item.data.musicTitle || 'Musique de fond' }}</span>
                  <span v-if="!item.data.backgroundMusic" class="mr-4">Son original - DJ Mombassa (Kinshasa Vibes)</span>
                  <span v-if="!item.data.backgroundMusic" class="mr-4">Son original - DJ Mombassa (Kinshasa Vibes)</span>
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

            <!-- Route Info Card (Top Center) -->
            <transition name="fade">
                <div v-if="showRouteInfo" class="absolute top-20 left-1/2 -translate-x-1/2 z-[500] bg-primary text-black px-4 py-2 rounded-full shadow-lg pointer-events-auto flex items-center gap-3">
                    <div class="flex items-center gap-1">
                        <span class="text-xs font-bold">📍 {{ routeInfo.distance }}</span>
                    </div>
                    <div class="w-[1px] h-4 bg-black/20"></div>
                    <div class="flex items-center gap-1">
                        <span class="text-xs font-bold">🕐 {{ routeInfo.duration }}</span>
                    </div>
                    <button @click="toggleRoute" class="ml-2 bg-black/20 hover:bg-black/30 p-1 rounded-full transition">
                        <X class="w-3 h-3" />
                    </button>
                </div>
            </transition>

             <!-- Floating Info (Hide if event is selected) -->
            <div v-if="!selectedMapEvent" class="absolute bottom-10 left-4 right-4 z-[500] bg-black/80 backdrop-blur-md p-3 rounded-xl border border-white/10 pointer-events-none">
                <p class="text-white text-center text-xs">Déplacez-vous sur la carte pour voir les événements.</p>
            </div>

            <!-- Route Toggle Button (Bottom Right) -->
            <button
                v-if="selectedMapEvent && coords.latitude !== Infinity"
                @click="toggleRoute"
                class="absolute bottom-32 right-4 z-[500] bg-primary text-black p-3 rounded-full shadow-lg pointer-events-auto hover:bg-primary/90 transition flex items-center gap-2 font-bold text-sm"
            >
                <MapIcon class="w-5 h-5" />
                <span>{{ routeLayer && mapInstance?.hasLayer(routeLayer) ? 'Masquer' : 'Itinéraire' }}</span>
            </button>

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
                 <!-- SECTION INFOS PROFIL -->
                 <div class="mb-6">
                   <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-colors duration-300">
                     <!-- User Info Card -->
                     <div class="p-4 flex items-center gap-4">
                       <div class="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-primary">
                         <img v-if="userStore.user?.avatar" :src="userStore.user.avatar" class="w-full h-full object-cover" />
                         <UserCircle v-else class="w-10 h-10 text-primary" />
                       </div>
                       <div class="flex-1 min-w-0">
                         <h3 class="font-bold text-lg text-gray-900 dark:text-white truncate">{{ userStore.user?.name || 'Visiteur' }}</h3>
                         <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ userStore.user?.email || 'Pas d\'email' }}</p>
                         <p class="text-xs text-gray-400 dark:text-gray-500">📱 {{ userStore.user?.phone || 'Non renseigné' }}</p>
                       </div>
                       <button @click="openProfileEdit" class="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition flex-shrink-0">
                         <Edit class="w-5 h-5 text-gray-600 dark:text-gray-400" />
                       </button>
                     </div>

                     <!-- Profile Edit Form (Accordion) -->
                     <transition name="fade">
                       <div v-if="showProfileEdit" class="border-t border-gray-200 dark:border-gray-800 p-4 space-y-3 bg-gray-50 dark:bg-gray-900/50">
                         <div>
                           <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Nom</label>
                           <input 
                             v-model="profileEditForm.name" 
                             type="text" 
                             placeholder="Votre nom" 
                             class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition"
                           />
                         </div>
                         <div>
                           <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Email</label>
                           <input 
                             v-model="profileEditForm.email" 
                             type="email" 
                             placeholder="votre@email.com" 
                             class="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition"
                           />
                         </div>
                         <div>
                           <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Téléphone</label>
                           <input 
                             v-model="profileEditForm.phone" 
                             type="tel" 
                             disabled
                             class="w-full bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-400 cursor-not-allowed"
                           />
                           <p class="text-[10px] text-gray-400 mt-1">Le téléphone ne peut pas être modifié (identifiant unique)</p>
                         </div>
                         <div v-if="profileEditSuccess" class="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm p-3 rounded-xl text-center font-medium">
                           {{ profileEditSuccess }}
                         </div>
                         <div class="flex gap-2">
                           <button 
                             @click="saveProfileEdit" 
                             :disabled="profileEditLoading"
                             class="flex-1 bg-primary hover:bg-primary/90 disabled:bg-gray-400 text-black font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
                           >
                             <Check class="w-4 h-4" />
                             <span v-if="!profileEditLoading">Enregistrer</span>
                             <span v-else>Sauvegarde...</span>
                           </button>
                           <button 
                             @click="showProfileEdit = false" 
                             class="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition font-medium"
                           >
                             Annuler
                           </button>
                         </div>
                       </div>
                     </transition>

                     <!-- Quick Actions -->
                     <div class="border-t border-gray-200 dark:border-gray-800 p-3 flex flex-col gap-2">
                       <!-- Admin Dashboard Button -->
                       <button 
                         v-if="adminStore.isAuthenticated"
                         @click="router.push('/admin/dashboard')" 
                         class="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm border border-red-500/20"
                       >
                         <Shield class="w-5 h-5" />
                         🛡️ Admin Dashboard
                       </button>
                       <!-- Admin Login Button (non-admin) -->
                       <button 
                         v-else
                         @click="router.push('/admin')" 
                         class="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-xs"
                       >
                         <LogIn class="w-4 h-4" />
                         Connexion Admin
                       </button>
                       <!-- Organizer Quick Actions -->
                       <div v-if="userStore.isOrganizer" class="flex gap-2">
                         <button 
                           @click="router.push('/admin/dashboard')" 
                           class="flex-1 bg-primary/10 hover:bg-primary/20 text-primary font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
                         >
                           <Calendar class="w-4 h-4" />
                           Gérer mes événements
                         </button>
                         <button 
                           @click="router.push('/admin/ads')" 
                           class="flex-1 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-500 font-medium py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
                         >
                           <Store class="w-4 h-4" />
                           Mes publicités
                         </button>
                       </div>
                     </div>
                   </div>
                 </div>

                 <!-- SECTION ORGANISATEUR -->
                 <div v-if="userStore.isOrganizer" class="mb-8">
                   <!-- Header Espace Organisateur -->
                   <div class="bg-gradient-to-r from-primary to-purple-600 rounded-2xl p-4 mb-4 text-black">
                     <div class="flex items-center justify-between">
                       <div>
                         <h3 class="font-bold text-lg flex items-center gap-2"><Store class="w-5 h-5" /> {{ userStore.user?.spaceName || 'Mon Espace' }}</h3>
                         <p class="text-xs opacity-80">Organisateur — {{ myOrganizerEvents.length }} événement(s)</p>
                       </div>
                       <button @click="router.push('/admin/dashboard')" class="bg-black/20 hover:bg-black/30 text-black px-3 py-2 rounded-xl text-sm font-bold transition flex items-center gap-1.5">
                         <Plus class="w-4 h-4" /> Créer
                       </button>
                     </div>
                   </div>

                   <!-- Liste des événements de l'organisateur -->
                   <div v-if="myOrganizerEvents.length > 0" class="space-y-3 mb-4">
                     <div v-for="event in myOrganizerEvents.slice(0, 5)" :key="'org-'+event.id" class="flex gap-3 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm transition-colors duration-300">
                       <div class="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-800 flex-shrink-0 overflow-hidden">
                         <img :src="event.image" class="w-full h-full object-cover" />
                       </div>
                       <div class="flex-1 min-w-0">
                         <h4 class="font-bold text-gray-900 dark:text-white text-sm truncate">{{ event.title }}</h4>
                         <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📅 {{ new Date(event.date).toLocaleDateString('fr-FR') }} • 📍 {{ event.location?.split(',')[0] }}</p>
                         <div class="flex items-center gap-1.5 mt-1.5">
                           <span class="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">{{ event.participantCount || 0 }} inscrits</span>
                           <span v-if="event.isPremium" class="text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full font-medium">Premium</span>
                         </div>
                       </div>
                       <div class="flex flex-col gap-1 flex-shrink-0">
                         <button @click="router.push('/admin/dashboard')" class="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                           <Edit class="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                         </button>
                         <button v-if="deleteConfirmId !== event.id" @click="deleteConfirmId = event.id" class="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition">
                           <Trash2 class="w-3.5 h-3.5 text-gray-600 dark:text-red-400" />
                         </button>
                         <div v-else class="flex flex-col gap-1">
                           <button @click="handleDeleteEvent(event.id)" class="p-1.5 bg-red-500 rounded-lg">
                             <Check class="w-3.5 h-3.5 text-white" />
                           </button>
                           <button @click="deleteConfirmId = null" class="p-1.5 bg-gray-300 dark:bg-gray-700 rounded-lg">
                             <X class="w-3.5 h-3.5 text-gray-700 dark:text-gray-300" />
                           </button>
                         </div>
                       </div>
                     </div>
                     <!-- Voir tout -->
                     <button v-if="myOrganizerEvents.length > 5" @click="router.push('/admin/dashboard')" class="w-full text-center text-sm text-primary font-medium py-2 hover:underline">
                       Voir tous les événements ({{ myOrganizerEvents.length }})
                     </button>
                   </div>

                   <!-- Aucun événement -->
                   <div v-else class="text-center py-8 bg-white dark:bg-gray-900 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                     <p class="text-gray-500 mb-3">Aucun événement créé pour le moment</p>
                     <button @click="router.push('/admin/dashboard')" class="bg-primary text-black font-bold px-4 py-2 rounded-xl inline-flex items-center gap-2 hover:bg-primary/90 transition text-sm">
                       <Plus class="w-4 h-4" /> Créer mon premier événement
                     </button>
                   </div>
                 </div>

                 <!-- DEVENIR ORGANISATEUR (non-organisateur) -->
                 <div v-else class="mb-8">
                   <div 
                     @click="showOrganizerForm = !showOrganizerForm"
                     class="bg-gradient-to-r from-primary to-purple-600 rounded-2xl p-4 text-black flex items-center justify-between shadow-lg shadow-primary/20 cursor-pointer hover:scale-[1.02] transition"
                   >
                     <div>
                       <h3 class="font-bold text-lg">Organiser un événement</h3>
                       <p class="text-xs opacity-80">Devenir organisateur — c'est gratuit !</p>
                     </div>
                     <div class="bg-black/20 p-2 rounded-full">
                       <Plus class="w-6 h-6 text-black" :class="showOrganizerForm ? 'rotate-45' : ''" style="transition: transform 0.3s" />
                     </div>
                   </div>

                   <!-- Formulaire devenir organisateur -->
                   <transition name="fade">
                     <div v-if="showOrganizerForm" class="mt-4 bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
                       <h4 class="font-bold text-gray-900 dark:text-white mb-1">Créer votre espace organisateur</h4>
                       <p class="text-xs text-gray-500 dark:text-gray-400 mb-4">Remplissez ce formulaire pour commencer à créer des événements</p>
                       
                       <div class="space-y-3">
                         <!-- Nom de l'organisateur -->
                         <div>
                           <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Votre nom d'organisateur</label>
                           <input 
                             v-model="organizerForm.organizerName"
                             type="text" 
                             :placeholder="userStore.user?.name || 'Ex: DJ Arafat Events'"
                             class="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition"
                           />
                         </div>
                         <!-- Nom de l'espace -->
                         <div>
                           <label class="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Nom de votre espace / organisation</label>
                           <input 
                             v-model="organizerForm.spaceName"
                             type="text" 
                             placeholder="Ex: Babi Events, Le Spot VIP..."
                             class="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary transition"
                           />
                         </div>
                         <!-- Error -->
                         <div v-if="organizerError" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl text-center font-medium">
                           {{ organizerError }}
                         </div>
                         <!-- Submit -->
                         <button 
                           @click="handleBecomeOrganizer"
                           :disabled="userStore.isLoading"
                           class="w-full bg-primary hover:bg-primary/90 disabled:bg-gray-700 text-black font-bold py-3 rounded-xl transition hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                         >
                           <Store class="w-5 h-5" />
                           <span v-if="!userStore.isLoading">Devenir organisateur 🚀</span>
                           <span v-else>Création en cours...</span>
                         </button>
                       </div>
                     </div>
                   </transition>
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
        <div v-if="showToast && toastEvent" class="fixed top-4 left-4 right-4 z-50 bg-gray-900 border border-primary text-white p-4 rounded-2xl shadow-2xl pointer-events-auto">
            <div class="flex items-start gap-3 mb-3">
                <div class="bg-primary/20 p-2 rounded-full shrink-0">
                    <MapPin class="w-5 h-5 text-primary" />
                </div>
                <div class="flex-1">
                    <p class="text-xs text-gray-400 mb-1">À proximité ({{ getDistanceFromLatLonInKm(coords.latitude, coords.longitude, toastEvent.coords.lat, toastEvent.coords.lng).toFixed(1) }} km)</p>
                    <p class="font-bold text-sm leading-tight">"{{ toastEvent.title }}" commence bientôt !</p>
                </div>
                <button @click="showToast = false" class="text-gray-500 hover:text-white shrink-0 -mt-1">
                    <X class="w-4 h-4" />
                </button>
            </div>
            <button
                @click="scrollToEvent(toastEvent.id)"
                class="w-full bg-primary text-black font-bold py-2.5 px-4 rounded-xl hover:bg-primary/90 transition active:scale-95 flex items-center justify-center gap-2"
            >
                <Heart class="w-4 h-4" />
                <span>J'y vais ! 🎉</span>
            </button>
        </div>
    </Transition>

    <!-- Google Maps Modal -->
    <transition name="fade">
        <div v-if="showGoogleMapsModal" class="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
            <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
                <!-- Header -->
                <div class="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
                    <div>
                        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Itinéraire</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400">{{ googleMapsLocation }}</p>
                    </div>
                    <button
                        @click="showGoogleMapsModal = false"
                        class="bg-gray-100 dark:bg-gray-800 p-2 rounded-full text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                        <X class="w-6 h-6" />
                    </button>
                </div>

                <!-- Maps Embed -->
                <div class="flex-1 relative bg-gray-100 dark:bg-gray-800">
                    <!-- OpenStreetMap Embed (No API key required) -->
                    <iframe
                        v-if="selectedMapEvent?.coords"
                        :src="`https://www.openstreetmap.org/export/embed.html?bbox=${selectedMapEvent.coords.lng - 0.01},${selectedMapEvent.coords.lat - 0.01},${selectedMapEvent.coords.lng + 0.01},${selectedMapEvent.coords.lat + 0.01}&layer=mapnik&marker=${selectedMapEvent.coords.lat},${selectedMapEvent.coords.lng}`"
                        class="w-full h-full border-0"
                        allowfullscreen
                        loading="lazy"
                    ></iframe>
                    <!-- Fallback for events without coordinates -->
                    <div v-else class="w-full h-full flex items-center justify-center">
                        <div class="text-center p-6">
                            <MapPin class="w-16 h-16 mx-auto mb-4 text-gray-400" />
                            <p class="text-gray-600 dark:text-gray-400 font-semibold mb-2">{{ googleMapsLocation }}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-500">Coordonnées GPS non disponibles</p>
                        </div>
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="p-4 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-3">
                    <button
                        @click="openExternalMap(googleMapsLocation)"
                        class="flex-1 bg-primary text-black font-bold py-3 px-4 rounded-xl hover:bg-primary/90 transition active:scale-95 flex items-center justify-center gap-2"
                    >
                        <MapIcon class="w-5 h-5" />
                        <span class="hidden sm:inline">Ouvrir dans Google Maps</span>
                        <span class="sm:hidden">Google Maps</span>
                    </button>
                    <button
                        v-if="selectedMapEvent && userStore.user?.phone"
                        @click="sendItineraryWhatsApp(selectedMapEvent); showGoogleMapsModal = false"
                        class="flex-1 bg-green-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-green-700 transition active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span>📱</span>
                        <span class="hidden sm:inline">Envoyer sur WhatsApp</span>
                        <span class="sm:hidden">WhatsApp</span>
                    </button>
                    <button
                        @click="showGoogleMapsModal = false"
                        class="sm:hidden bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white font-bold py-3 px-4 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition active:scale-95"
                    >
                        Fermer
                    </button>
                </div>
            </div>
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

/* Translation Up Animation */
.up-enter-active, .up-leave-active {
  transition: transform 0.3s ease-in-out;
}
.up-enter-from, .up-leave-to {
  transform: translateY(100%);
}
/* Splash screen transition */
.splash-leave-active {
    transition: opacity 0.5s ease, transform 0.5s ease;
}
.splash-leave-to {
    opacity: 0;
    transform: scale(1.1);
}
</style>
