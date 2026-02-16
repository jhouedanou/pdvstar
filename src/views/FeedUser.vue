<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import { useAdminStore } from '../stores/adminStore'
import { useGeolocation } from '@vueuse/core'
import { Heart, MapPin, Share2, Loader, Search, UserCircle, Home, X, Calendar, Plus, Map as MapIcon, Sun, Moon, Crown, Edit, Trash2, Check, Store, Volume2, VolumeX, Shield, LogIn, Ticket, Lock, CreditCard, ChevronRight, Sparkles } from 'lucide-vue-next'
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

const appName = 'Babi Vibes'

// Splash screen : simule la première interaction pour débloquer l'autoplay audio
const hasInteracted = ref(false)

const enterApp = () => {
    hasInteracted.value = true
    // Petit délai pour laisser le DOM charger les iframes avant de lancer la lecture
    setTimeout(() => syncYouTubePlayback(), 500)
}

// Helper : date label pour bandeaux
const getDateLabel = (dateStr) => {
    const eventDate = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
    if (eventDay.getTime() === today.getTime()) return 'today'
    if (eventDay.getTime() === tomorrow.getTime()) return 'tomorrow'
    return eventDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const getDateDisplayText = (dateStr) => {
    const label = getDateLabel(dateStr)
    if (label === 'today') return "Aujourd'hui"
    if (label === 'tomorrow') return 'Demain'
    return label
}

// Algo de pertinence : scoring des événements
const computeRelevanceScore = (event) => {
    let score = 0
    const now = new Date()
    const eventDate = new Date(event.date)
    const hoursUntil = (eventDate - now) / (1000 * 60 * 60)

    // 1. Proximité temporelle (événements proches = score plus élevé)
    if (hoursUntil <= 6) score += 50       // Dans les 6h
    else if (hoursUntil <= 24) score += 35  // Aujourd'hui
    else if (hoursUntil <= 48) score += 20  // Demain
    else if (hoursUntil <= 168) score += 10 // Cette semaine
    else score += 2

    // 2. Popularité (nombre d'inscrits)
    score += Math.min((event.participantCount || 0) * 2, 30)

    // 3. Événement premium (boost sponsorisé)
    if (event.isPremium) score += 15

    // 4. Proximité géographique (si géolocalisation dispo)
    if (coords.value?.latitude && event.coords?.lat) {
        const dist = getDistanceFromLatLonInKm(coords.value.latitude, coords.value.longitude, event.coords.lat, event.coords.lng)
        if (dist < 5) score += 25         // < 5km
        else if (dist < 15) score += 15   // < 15km
        else if (dist < 50) score += 5    // < 50km
    }

    // 5. Organisateur suivi (boost de pertinence)
    if (userStore.user?.following?.includes(event.organizer)) score += 20

    // 6. Avec image ou vidéo (contenu riche)
    if (event.image) score += 5
    if (event.videoUrl) score += 5

    // 7. Avec promo
    if (event.promoText) score += 10

    return score
}

// Mix events and ads (every 5 events, insert an ad)
const feedItems = computed(() => {
    const items = []
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    // Filtrer uniquement les events à venir (aujourd'hui inclus), approuvés
    const upcomingEvents = [...eventStore.events]
        .filter(e => {
            if (!e.date) return false
            if (e.status && e.status !== 'approved') return false
            return new Date(e.date) >= today
        })
        // Tri par score de pertinence (décroissant) puis par date (croissant) en cas d'égalité
        .map(e => ({ ...e, _score: computeRelevanceScore(e) }))
        .sort((a, b) => {
            if (b._score !== a._score) return b._score - a._score
            return new Date(a.date) - new Date(b.date)
        })
    const adsList = ads.value

    upcomingEvents.forEach((event, index) => {
        items.push({ type: 'event', data: event })

        // Insert ad every 5 events (sauf si utilisateur Premium — pas de pubs)
        const isPremiumUser = userStore.hasActivePass && userStore.activePassInfo?.id === 'premium'
        if (!isPremiumUser && (index + 1) % 5 === 0 && adsList[Math.floor(index / 5) % adsList.length]) {
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

const handleWheel = (e) => {
    if (!feedContainer.value) return
    
    // Prevent default scroll behavior
    e.preventDefault()
    
    // Avoid multiple rapid scrolls
    if (isScrolling) return
    
    const delta = e.deltaY
    const threshold = 50 // Sensitivity threshold
    
    if (Math.abs(delta) > threshold) {
        isScrolling = true
        
        const container = feedContainer.value
        const slideHeight = container.clientHeight
        const direction = delta > 0 ? 1 : -1
        
        // Calculer l'index cible basé sur la slide courante (pas le scrollTop brut)
        const targetIndex = Math.max(0, Math.min(feedItems.value.length - 1, currentSlideIndex.value + direction))
        
        if (targetIndex !== currentSlideIndex.value) {
            currentSlideIndex.value = targetIndex
            container.scrollTo({
                top: targetIndex * slideHeight,
                behavior: 'smooth'
            })
            syncYouTubePlayback()
        }
        
        // Reset scrolling flag after animation
        setTimeout(() => {
            isScrolling = false
        }, 600)
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

// --- Passes d'accès ---
const showPassShop = ref(false)
const selectedPassType = ref(null)
const selectedPaymentMethod = ref(null)
const passPurchaseStep = ref('choose') // 'choose' | 'payment' | 'confirm' | 'success'
const passPurchaseLoading = ref(false)

// Import catalogue
import { PASS_CATALOG, PAYMENT_METHODS } from '../services/supabase'

const passOptions = computed(() => Object.values(PASS_CATALOG))

const selectPass = (passId) => {
    selectedPassType.value = passId
    passPurchaseStep.value = 'payment'
}

const selectPayment = (methodId) => {
    selectedPaymentMethod.value = methodId
    passPurchaseStep.value = 'confirm'
}

const confirmPassPurchase = async () => {
    if (!selectedPassType.value || !selectedPaymentMethod.value) return
    passPurchaseLoading.value = true
    const ref_id = 'BV-' + Date.now().toString(36).toUpperCase()
    const pass = await userStore.buyPass(selectedPassType.value, selectedPaymentMethod.value, ref_id)
    passPurchaseLoading.value = false
    if (pass) {
        passPurchaseStep.value = 'success'
    }
}

const closePassShop = () => {
    showPassShop.value = false
    selectedPassType.value = null
    selectedPaymentMethod.value = null
    passPurchaseStep.value = 'choose'
}

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
const searchDateFilter = ref('all') // all, today, this_week, this_month
const searchPriceFilter = ref('all') // all, free, paid
const searchLocationFilter = ref('')
const searchTagFilter = ref('')

// Extraire les lieux uniques et tags uniques pour les filtres
const uniqueLocations = computed(() => {
    const locations = eventStore.events.map(e => e.location).filter(Boolean)
    return [...new Set(locations)].sort()
})
const uniqueTags = computed(() => {
    const tags = eventStore.events.flatMap(e => e.features || []).filter(Boolean)
    return [...new Set(tags)].sort()
})

const resetSearchFilters = () => {
    searchQuery.value = ''
    showPremiumOnly.value = false
    searchDateFilter.value = 'all'
    searchPriceFilter.value = 'all'
    searchLocationFilter.value = ''
    searchTagFilter.value = ''
}

const activeFiltersCount = computed(() => {
    let count = 0
    if (showPremiumOnly.value) count++
    if (searchDateFilter.value !== 'all') count++
    if (searchPriceFilter.value !== 'all') count++
    if (searchLocationFilter.value) count++
    if (searchTagFilter.value) count++
    return count
})

const dateFilterOptions = [
    { v: 'all', l: 'Toutes dates' },
    { v: 'today', l: "Aujourd'hui" },
    { v: 'this_week', l: 'Cette semaine' },
    { v: 'this_month', l: 'Ce mois' }
]

const priceFilterOptions = [
    { v: 'all', l: 'Tous prix' },
    { v: 'free', l: 'Gratuit' },
    { v: 'paid', l: 'Payant' }
]

const filteredEvents = computed(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    
    let results = eventStore.events
        .filter(e => !!e.date && new Date(e.date) >= today)
        .filter(e => !e.status || e.status === 'approved') // modération
    
    // Filtre premium
    if (showPremiumOnly.value) {
        results = results.filter(e => e.isPremium)
    }
    
    // Filtre par mots-clés
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase()
        results = results.filter(e => 
            (e.title || '').toLowerCase().includes(q) || 
            (e.description || '').toLowerCase().includes(q) ||
            (e.location || '').toLowerCase().includes(q) ||
            (e.organizer || '').toLowerCase().includes(q) ||
            (e.features || []).some(f => f.toLowerCase().includes(q))
        )
    }

    // Filtre par date
    if (searchDateFilter.value !== 'all') {
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
        const endOfWeek = new Date(today); endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

        if (searchDateFilter.value === 'today') {
            results = results.filter(e => {
                const d = new Date(e.date)
                return d >= today && d < tomorrow
            })
        } else if (searchDateFilter.value === 'this_week') {
            results = results.filter(e => new Date(e.date) <= endOfWeek)
        } else if (searchDateFilter.value === 'this_month') {
            results = results.filter(e => new Date(e.date) <= endOfMonth)
        }
    }

    // Filtre par prix
    if (searchPriceFilter.value === 'free') {
        results = results.filter(e => !e.isPremium || !e.price)
    } else if (searchPriceFilter.value === 'paid') {
        results = results.filter(e => e.isPremium && e.price > 0)
    }

    // Filtre par lieu
    if (searchLocationFilter.value) {
        results = results.filter(e => (e.location || '').toLowerCase().includes(searchLocationFilter.value.toLowerCase()))
    }

    // Filtre par tag/catégorie
    if (searchTagFilter.value) {
        results = results.filter(e => (e.features || []).some(f => f === searchTagFilter.value))
    }
    
    // Tri chronologique : du plus proche au plus lointain
    return results.sort((a, b) => new Date(a.date) - new Date(b.date))
})

const handleSearchSelect = (event) => {
    // Fermer la recherche et scroller vers l'event dans le feed
    showSearch.value = false
    resetSearchFilters()
    
    nextTick(() => {
        const eventIndex = feedItems.value.findIndex(item =>
            item.type === 'event' && item.data.id === event.id
        )
        if (eventIndex !== -1 && feedContainer.value) {
            const slideHeight = window.innerHeight
            currentSlideIndex.value = eventIndex
            feedContainer.value.scrollTo({
                top: eventIndex * slideHeight,
                behavior: 'smooth'
            })
            setTimeout(() => syncYouTubePlayback(), 500)
        }
    })
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

// VTC Deep Links
const openVTC = (provider) => {
    const event = selectedMapEvent.value
    if (!event?.coords) return
    const lat = event.coords.lat
    const lng = event.coords.lng
    const label = encodeURIComponent(event.title || event.location || 'Destination')

    let url = ''
    switch (provider) {
        case 'uber':
            url = `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${label}`
            break
        case 'yango':
            url = `https://yango.yandex.com/route?end-lat=${lat}&end-lon=${lng}`
            break
        case 'waze':
            url = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes&z=17`
            break
    }
    if (url) window.open(url, '_blank')
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

/**
 * Extraire l'ID d'une vidéo TikTok depuis une URL
 */
const getTikTokId = (url) => {
    if (!url) return null
    const patterns = [
        /tiktok\.com\/@[^/]+\/video\/(\d+)/,
        /vm\.tiktok\.com\/([a-zA-Z0-9]+)/,
        /tiktok\.com\/t\/([a-zA-Z0-9]+)/
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
    <div ref="feedContainer" class="feed-container snap-y snap-mandatory h-screen w-full overflow-y-scroll no-scrollbar">
      <template v-for="(item, itemIndex) in feedItems" :key="item.type === 'event' ? item.data.id : item.data.id">
        <!-- AD SLIDE -->
        <AdBanner v-if="item.type === 'ad'" :ad="item.data" />

        <!-- EVENT SLIDE -->
        <div v-else class="event-slide snap-start h-screen w-full relative bg-dark-lighter flex items-end shrink-0">

        <!-- Background Image/Video -->
        <div class="absolute inset-0 bg-gray-900">
           <!-- Image de couverture (toujours présente en base, même derrière une vidéo) -->
           <img
             v-if="item.data.image"
             :src="item.data.image"
             alt="Event Cover"
             class="absolute inset-0 w-full h-full object-cover opacity-90"
           />
           <div v-else class="absolute inset-0 w-full h-full bg-gradient-to-br from-primary/30 via-gray-900 to-gray-800"></div>
           <!-- YouTube Video Background (plein écran, par-dessus l'image) -->
           <iframe
             v-if="hasInteracted && (item.data.mediaType === 'youtube' || item.data.mediaType === 'youtube_short') && item.data.videoUrl && getYouTubeId(item.data.videoUrl)"
             :src="`https://www.youtube.com/embed/${getYouTubeId(item.data.videoUrl)}?autoplay=${itemIndex === currentSlideIndex ? 1 : 0}&mute=1&loop=1&playlist=${getYouTubeId(item.data.videoUrl)}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(appOrigin)}`"
             class="absolute inset-0 w-full h-full border-0 pointer-events-none z-[1]"
             :style="item.data.mediaType === 'youtube' ? 'transform: scale(1.5);' : ''"
             frameborder="0"
             allow="autoplay; encrypted-media"
             :loading="itemIndex < 3 ? 'eager' : 'lazy'"
           ></iframe>
           <!-- TikTok Video Background (embed, par-dessus l'image) -->
           <iframe
             v-if="hasInteracted && item.data.mediaType === 'tiktok' && item.data.videoUrl && getTikTokId(item.data.videoUrl)"
             :src="`https://www.tiktok.com/embed/v2/${getTikTokId(item.data.videoUrl)}?lang=fr`"
             class="absolute inset-0 w-full h-full border-0 z-[1]"
             frameborder="0"
             allow="autoplay; encrypted-media"
             :loading="itemIndex < 3 ? 'eager' : 'lazy'"
           ></iframe>
           <!-- YouTube Background AUDIO (iframe caché pour musique de fond, séparé de la vidéo d'illustration) -->
           <iframe 
             v-if="hasInteracted && item.data.backgroundMusic && getYouTubeId(item.data.backgroundMusic) && !(item.data.mediaType === 'youtube' || item.data.mediaType === 'youtube_short')"
             :src="`https://www.youtube.com/embed/${getYouTubeId(item.data.backgroundMusic)}?autoplay=${itemIndex === 0 ? 1 : 0}&mute=${itemIndex === 0 ? 0 : 1}&loop=1&playlist=${getYouTubeId(item.data.backgroundMusic)}&controls=0&showinfo=0&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(appOrigin)}`"
             class="absolute pointer-events-none"
             style="width:1px;height:1px;opacity:0;position:absolute;bottom:0;left:0;"
             frameborder="0"
             allow="autoplay; encrypted-media"
             :loading="itemIndex < 3 ? 'eager' : 'lazy'"
           ></iframe>
           <div class="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black" :class="{ 'pointer-events-none': item.data.mediaType === 'tiktok' }"></div>
           <div class="absolute bottom-0 left-0 right-0 h-[75%] bg-gradient-to-t from-black via-black/95 to-transparent pointer-events-none"></div>
        </div>

        <!-- Premium Badge (Top Left) -->
        <div v-if="item.data.isPremium" class="absolute top-20 left-4 z-20">
            <div class="bg-gradient-to-r from-yellow-400 to-orange-500 text-black px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-lg">
                <Crown class="w-4 h-4" />
                <span>PREMIUM</span>
            </div>
        </div>

        <!-- Premium Lock Overlay (si pas de pass actif) -->
        <div v-if="item.data.isPremium && !userStore.canAccessPremium" 
          class="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          @click="showPassShop = true">
          <div class="text-center px-8 py-6 max-w-[280px]">
            <div class="bg-yellow-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock class="w-8 h-8 text-yellow-400" />
            </div>
            <h3 class="text-white font-black text-lg mb-1">Contenu Premium</h3>
            <p class="text-gray-300 text-sm mb-4">Obtenez un pass pour accéder à cet événement</p>
            <div class="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black px-6 py-2.5 rounded-full text-sm inline-flex items-center gap-2 shadow-lg">
              <Ticket class="w-4 h-4" />
              Obtenir un Pass
            </div>
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
            <!-- Date de l'événement -->
            <div v-if="item.data.date" class="flex items-center gap-1.5 mb-1 flex-wrap">
              <Calendar class="w-4 h-4 text-primary" />
              <span class="text-sm font-semibold text-primary">
                {{ getDateDisplayText(item.data.date) }}
                à {{ new Date(item.data.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}
              </span>
              <span v-if="getDateLabel(item.data.date) === 'today'" class="bg-red-500/40 text-red-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-pulse">🔴 AUJOURD'HUI</span>
              <span v-else-if="getDateLabel(item.data.date) === 'tomorrow'" class="bg-orange-500/40 text-orange-300 text-[10px] px-1.5 py-0.5 rounded-full font-bold">⏰ DEMAIN</span>
            </div>
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
             <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-500">Recherche</h2>
                <div class="flex items-center gap-2">
                    <button v-if="activeFiltersCount > 0" @click="resetSearchFilters" class="text-xs text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-full">
                        Réinitialiser ({{ activeFiltersCount }})
                    </button>
                    <button @click="showSearch = false; resetSearchFilters()" class="text-gray-900 dark:text-white p-2"><X class="w-7 h-7" /></button>
                </div>
            </div>

            <!-- Search Input -->
            <div class="relative mb-3">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input 
                    v-model="searchQuery" 
                    type="text" 
                    placeholder="Chercher un artiste, un lieu, un type..." 
                    class="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-transparent rounded-xl py-3 pl-10 pr-10 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    autofocus
                >
                <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X class="w-4 h-4" />
                </button>
            </div>

            <!-- Filters Row -->
            <div class="flex flex-col gap-2 mb-4">
                <!-- Date Filter -->
                <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button v-for="opt in dateFilterOptions" 
                        :key="opt.v"
                        @click="searchDateFilter = opt.v"
                        class="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition border"
                        :class="searchDateFilter === opt.v ? 'bg-primary text-black border-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'"
                    >
                        <Calendar v-if="opt.v !== 'all'" class="w-3 h-3 inline mr-1" />{{ opt.l }}
                    </button>
                </div>

                <!-- Price + Premium Filter -->
                <div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button v-for="opt in priceFilterOptions" 
                        :key="opt.v"
                        @click="searchPriceFilter = opt.v"
                        class="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition border"
                        :class="searchPriceFilter === opt.v ? 'bg-primary text-black border-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'"
                    >
                        {{ opt.l }}
                    </button>
                    <button 
                        @click="showPremiumOnly = !showPremiumOnly"
                        class="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition border flex items-center gap-1"
                        :class="showPremiumOnly ? 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-amber-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'"
                    >
                        <Crown class="w-3 h-3" /> Premium
                    </button>
                </div>

                <!-- Location Filter -->
                <div v-if="uniqueLocations.length > 1" class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button 
                        @click="searchLocationFilter = ''"
                        class="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition border"
                        :class="!searchLocationFilter ? 'bg-primary text-black border-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'"
                    >Tous lieux</button>
                    <button v-for="loc in uniqueLocations.slice(0, 10)" 
                        :key="loc"
                        @click="searchLocationFilter = searchLocationFilter === loc ? '' : loc"
                        class="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition border"
                        :class="searchLocationFilter === loc ? 'bg-primary text-black border-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'"
                    >
                        <MapPin class="w-3 h-3 inline mr-0.5" />{{ loc.length > 20 ? loc.slice(0,20) + '…' : loc }}
                    </button>
                </div>

                <!-- Tag/Category Filter -->
                <div v-if="uniqueTags.length > 0" class="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button 
                        @click="searchTagFilter = ''"
                        class="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition border"
                        :class="!searchTagFilter ? 'bg-primary text-black border-primary' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'"
                    >Toutes catégories</button>
                    <button v-for="tag in uniqueTags.slice(0, 15)" 
                        :key="tag"
                        @click="searchTagFilter = searchTagFilter === tag ? '' : tag"
                        class="whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition border"
                        :class="searchTagFilter === tag ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'"
                    >
                        ✨ {{ tag }}
                    </button>
                </div>
            </div>

            <!-- Results Count -->
            <div class="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                {{ filteredEvents.length }} événement{{ filteredEvents.length > 1 ? 's' : '' }} trouvé{{ filteredEvents.length > 1 ? 's' : '' }}
            </div>

            <!-- Results -->
            <div class="flex-1 overflow-y-auto">
                <div v-if="filteredEvents.length === 0" class="text-center text-gray-500 mt-10">
                    <Search class="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p class="font-semibold">Aucun résultat</p>
                    <p class="text-sm mt-1">Essayez d'autres filtres ou mots-clés</p>
                </div>
                
                <div class="space-y-3 pb-24">
                    <div v-for="event in filteredEvents" :key="event.id" 
                         @click="handleSearchSelect(event)"
                         class="bg-white dark:bg-gray-800/80 rounded-xl overflow-hidden active:scale-[0.98] transition cursor-pointer shadow-md dark:shadow-none flex h-24">
                        <!-- Image -->
                        <div class="w-24 h-24 flex-shrink-0 relative">
                            <img :src="event.image" class="w-full h-full object-cover" />
                            <div v-if="event.isPremium" class="absolute top-1 right-1 bg-gradient-to-r from-yellow-400 to-amber-500 p-0.5 rounded-full">
                                <Crown class="w-2.5 h-2.5 text-black" />
                            </div>
                        </div>
                        <!-- Info -->
                        <div class="flex-1 p-2.5 flex flex-col justify-between min-w-0">
                            <div>
                                <h3 class="font-bold text-sm truncate text-gray-900 dark:text-white">{{ event.title }}</h3>
                                <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    <Calendar class="w-3 h-3 text-primary flex-shrink-0" />
                                    <span class="text-primary font-semibold">{{ getDateDisplayText(event.date) }}</span>
                                    <span>à {{ new Date(event.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}</span>
                                </div>
                            </div>
                            <div class="flex items-center justify-between">
                                <span class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-0.5 truncate">
                                    <MapPin class="w-3 h-3 flex-shrink-0" />{{ event.location }}
                                </span>
                                <span v-if="event.isPremium && event.price" class="text-xs font-bold text-amber-500 whitespace-nowrap ml-2">
                                    {{ event.price?.toLocaleString() }} CFA
                                </span>
                                <span v-else class="text-xs font-medium text-green-500 whitespace-nowrap ml-2">Gratuit</span>
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

                 <!-- SECTION MON PASS -->
                 <div class="mb-6">
                   <!-- Pass actif -->
                   <div v-if="userStore.hasActivePass && userStore.activePassInfo" class="bg-gradient-to-br rounded-2xl p-4 mb-3 border border-white/10 shadow-lg relative overflow-hidden"
                     :class="userStore.activePassInfo.color">
                     <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10"></div>
                     <div class="relative z-10">
                       <div class="flex items-center justify-between mb-3">
                         <div class="flex items-center gap-2">
                           <span class="text-2xl">{{ userStore.activePassInfo.emoji }}</span>
                           <div>
                             <h3 class="font-black text-white text-lg">Pass {{ userStore.activePassInfo.name }}</h3>
                             <p class="text-white/70 text-xs">Expire le {{ userStore.activePassInfo.expiresFormatted }}</p>
                           </div>
                         </div>
                         <div class="bg-white/20 backdrop-blur px-3 py-1.5 rounded-full">
                           <span class="text-white font-bold text-sm">{{ userStore.activePassInfo.daysLeft }}j restant(s)</span>
                         </div>
                       </div>
                       <div class="flex flex-wrap gap-1.5">
                         <span v-for="feat in userStore.activePassInfo.features" :key="feat" class="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">
                           {{ feat }}
                         </span>
                       </div>
                     </div>
                   </div>
                   <!-- Pas de pass actif -->
                   <div v-else @click="showPassShop = true"
                     class="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-4 text-white flex items-center justify-between shadow-lg cursor-pointer hover:scale-[1.02] transition active:scale-95">
                     <div class="flex items-center gap-3">
                       <div class="bg-white/20 p-2.5 rounded-xl">
                         <Ticket class="w-6 h-6" />
                       </div>
                       <div>
                         <h3 class="font-bold text-base">Obtenir un Pass</h3>
                         <p class="text-white/70 text-xs">Accédez au contenu premium</p>
                       </div>
                     </div>
                     <ChevronRight class="w-5 h-5 text-white/70" />
                   </div>
                   <button v-if="userStore.hasActivePass" @click="showPassShop = true" class="w-full text-center text-xs text-primary font-medium mt-2 hover:underline">
                     Changer de pass / Renouveler
                   </button>
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

                 <!-- Liens légaux -->
                 <div class="mt-8 pt-4 border-t border-gray-200 dark:border-gray-800 text-center space-y-2">
                   <button @click="router.push('/legal?tab=cgu')" class="text-xs text-gray-400 hover:text-primary transition underline mr-3">CGU</button>
                   <button @click="router.push('/legal?tab=cgv')" class="text-xs text-gray-400 hover:text-primary transition underline mr-3">CGV</button>
                   <button @click="router.push('/legal?tab=privacy')" class="text-xs text-gray-400 hover:text-primary transition underline">Confidentialité</button>
                   <p class="text-[10px] text-gray-500 mt-2">{{ appName }} v1.0 — © 2025</p>
                 </div>
            </div>
        </div>
    </transition>
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

    <!-- BOUTIQUE DE PASSES -->
    <Teleport to="body">
      <transition name="up">
        <div v-if="showPassShop" class="fixed inset-0 bg-black z-[60] flex flex-col overflow-y-auto">
          <!-- Header -->
          <div class="px-5 py-4 flex justify-between items-center border-b border-gray-800 bg-black/90 backdrop-blur-md sticky top-0 z-10">
            <div>
              <h2 class="text-xl font-black text-white flex items-center gap-2">
                <Sparkles class="w-5 h-5 text-yellow-400" /> Boutique Passes
              </h2>
              <p class="text-xs text-gray-400">Débloquez le contenu premium</p>
            </div>
            <button @click="closePassShop" class="bg-gray-800 p-2 rounded-full hover:bg-gray-700 transition">
              <X class="w-5 h-5 text-white" />
            </button>
          </div>

          <div class="p-5 pb-32">
            <!-- STEP 1 : Choix du pass -->
            <div v-if="passPurchaseStep === 'choose'">
              <p class="text-gray-400 text-sm mb-5">Choisissez votre pass pour accéder aux événements et contenus premium.</p>
              <div class="space-y-4">
                <div v-for="pass in passOptions" :key="pass.id"
                  @click="selectPass(pass.id)"
                  class="relative rounded-2xl p-5 border-2 cursor-pointer transition hover:scale-[1.02] active:scale-95 overflow-hidden"
                  :class="pass.popular ? 'border-purple-500 bg-gradient-to-br from-purple-900/40 to-pink-900/30' : 'border-gray-800 bg-gray-900 hover:border-gray-600'">
                  <!-- Popular badge -->
                  <div v-if="pass.popular" class="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl">POPULAIRE</div>
                  <div class="flex items-start gap-4">
                    <div class="text-3xl">{{ pass.emoji }}</div>
                    <div class="flex-1">
                      <div class="flex items-center justify-between">
                        <h3 class="text-white font-bold text-lg">{{ pass.name }}</h3>
                        <div class="text-right">
                          <span class="text-2xl font-black text-white">{{ pass.price.toLocaleString() }}</span>
                          <span class="text-gray-400 text-sm ml-1">{{ pass.currency }}</span>
                        </div>
                      </div>
                      <p class="text-gray-400 text-sm mt-1">{{ pass.description }}</p>
                      <div class="flex flex-wrap gap-1.5 mt-3">
                        <span v-for="feat in pass.features" :key="feat" class="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                          {{ feat }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- STEP 2 : Méthode de paiement -->
            <div v-else-if="passPurchaseStep === 'payment'">
              <button @click="passPurchaseStep = 'choose'" class="text-gray-400 text-sm mb-4 flex items-center gap-1 hover:text-white transition">
                ← Retour aux passes
              </button>
              <h3 class="text-white font-bold text-lg mb-1">Méthode de paiement</h3>
              <p class="text-gray-400 text-sm mb-5">Pass {{ PASS_CATALOG[selectedPassType]?.name }} — {{ PASS_CATALOG[selectedPassType]?.price?.toLocaleString() }} CFA</p>
              <div class="space-y-3">
                <div v-for="method in PAYMENT_METHODS" :key="method.id"
                  @click="selectPayment(method.id)"
                  class="flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition hover:scale-[1.02] active:scale-95"
                  :class="'border-gray-800 bg-gray-900 hover:border-gray-600'">
                  <div class="text-2xl">{{ method.emoji }}</div>
                  <div class="flex-1">
                    <h4 class="text-white font-bold">{{ method.name }}</h4>
                  </div>
                  <ChevronRight class="w-5 h-5 text-gray-500" />
                </div>
              </div>
            </div>

            <!-- STEP 3 : Confirmation -->
            <div v-else-if="passPurchaseStep === 'confirm'">
              <button @click="passPurchaseStep = 'payment'" class="text-gray-400 text-sm mb-4 flex items-center gap-1 hover:text-white transition">
                ← Retour au paiement
              </button>
              <div class="bg-gray-900 rounded-2xl p-5 border border-gray-800 mb-6">
                <h3 class="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <CreditCard class="w-5 h-5 text-primary" /> Récapitulatif
                </h3>
                <div class="space-y-3 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-400">Pass</span>
                    <span class="text-white font-bold">{{ PASS_CATALOG[selectedPassType]?.emoji }} {{ PASS_CATALOG[selectedPassType]?.name }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Durée</span>
                    <span class="text-white">{{ PASS_CATALOG[selectedPassType]?.durationDays }} jours</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-400">Paiement</span>
                    <span class="text-white">{{ PAYMENT_METHODS.find(m => m.id === selectedPaymentMethod)?.emoji }} {{ PAYMENT_METHODS.find(m => m.id === selectedPaymentMethod)?.name }}</span>
                  </div>
                  <div class="border-t border-gray-700 pt-3 flex justify-between">
                    <span class="text-gray-300 font-bold">Total</span>
                    <span class="text-2xl font-black text-white">{{ PASS_CATALOG[selectedPassType]?.price?.toLocaleString() }} <span class="text-sm text-gray-400">CFA</span></span>
                  </div>
                </div>
              </div>
              <button 
                @click="confirmPassPurchase"
                :disabled="passPurchaseLoading"
                class="w-full bg-gradient-to-r from-primary to-purple-600 text-black font-black py-4 rounded-2xl text-lg transition hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                <Ticket class="w-5 h-5" />
                <span v-if="!passPurchaseLoading">Confirmer le paiement</span>
                <span v-else class="flex items-center gap-2"><Loader class="w-5 h-5 animate-spin" /> Traitement...</span>
              </button>
              <p class="text-gray-500 text-[10px] text-center mt-3">En confirmant, vous acceptez les conditions d'utilisation de Babi Vibes.</p>
            </div>

            <!-- STEP 4 : Succès -->
            <div v-else-if="passPurchaseStep === 'success'" class="text-center py-10">
              <div class="text-6xl mb-4">🎉</div>
              <h3 class="text-2xl font-black text-white mb-2">Pass activé !</h3>
              <p class="text-gray-400 mb-6">Votre Pass {{ PASS_CATALOG[selectedPassType]?.name }} est maintenant actif.</p>
              <div class="bg-green-500/20 text-green-400 p-4 rounded-xl inline-flex items-center gap-2 font-bold text-sm mb-6">
                <Check class="w-5 h-5" />
                Valide pendant {{ PASS_CATALOG[selectedPassType]?.durationDays }} jours
              </div>
              <br/>
              <button @click="closePassShop" class="bg-primary text-black font-bold px-8 py-3 rounded-xl hover:bg-primary/90 transition mt-4">
                Retour au profil
              </button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

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
                <div class="p-4 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3">
                    <!-- Ligne 1 : Navigation -->
                    <div class="flex gap-2">
                      <button
                          @click="openExternalMap(googleMapsLocation)"
                          class="flex-1 bg-primary text-black font-bold py-3 px-4 rounded-xl hover:bg-primary/90 transition active:scale-95 flex items-center justify-center gap-2"
                      >
                          <MapIcon class="w-5 h-5" />
                          Google Maps
                      </button>
                      <button
                          v-if="selectedMapEvent && userStore.user?.phone"
                          @click="sendItineraryWhatsApp(selectedMapEvent); showGoogleMapsModal = false"
                          class="flex-1 bg-green-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-green-700 transition active:scale-95 flex items-center justify-center gap-2"
                      >
                          <span>📱</span>
                          WhatsApp
                      </button>
                    </div>
                    <!-- Ligne 2 : VTC Deep Links -->
                    <div v-if="selectedMapEvent?.coords" class="flex gap-2">
                      <button
                          @click="openVTC('uber')"
                          class="flex-1 bg-black text-white font-bold py-2.5 px-3 rounded-xl hover:bg-gray-900 transition active:scale-95 flex items-center justify-center gap-2 text-sm border border-gray-700"
                      >
                          🚕 Uber
                      </button>
                      <button
                          @click="openVTC('yango')"
                          class="flex-1 bg-red-600 text-white font-bold py-2.5 px-3 rounded-xl hover:bg-red-700 transition active:scale-95 flex items-center justify-center gap-2 text-sm"
                      >
                          🚗 Yango
                      </button>
                      <button
                          @click="openVTC('waze')"
                          class="flex-1 bg-blue-500 text-white font-bold py-2.5 px-3 rounded-xl hover:bg-blue-600 transition active:scale-95 flex items-center justify-center gap-2 text-sm"
                      >
                          🗺️ Waze
                      </button>
                    </div>
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
