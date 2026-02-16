<script setup>
import { ref, computed, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/adminStore'
import { useEventStore } from '../stores/eventStore'
import { useUserStore } from '../stores/userStore'
import {
    LogOut, Plus, Edit, Trash2, Calendar, MapPin,
    X, Check, Camera, Save, ArrowLeft, Mic, MicOff, Volume2,
    Search, Loader2, Navigation, Tag, Store, Megaphone,
    Video, SwitchCamera, Locate, CameraOff
} from 'lucide-vue-next'
import L from 'leaflet'

const router = useRouter()
const adminStore = useAdminStore()
const eventStore = useEventStore()
const userStore = useUserStore()

// Détection du mode : admin classique ou organisateur
const isOrganizerMode = computed(() => !adminStore.isAuthenticated && userStore.isOrganizer)

// Charger les événements et demander les permissions au montage
onMounted(async () => {
    await eventStore.loadEvents()
    // Demander les permissions au montage
    requestMicPermission()
    requestCameraPermission()
    requestGeoPermission()
    // Charger le CSS Leaflet pour le map picker
    if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        document.head.appendChild(link)
    }
})

// Permission microphone
const micPermission = ref('prompt') // 'granted' | 'denied' | 'prompt'

/**
 * Demander la permission microphone dès l'entrée dans l'admin
 * Cela déclenche le popup de permission du navigateur une seule fois
 */
const requestMicPermission = async () => {
    try {
        // 1. Vérifier d'abord via l'API Permissions si disponible
        if (navigator.permissions) {
            try {
                const permStatus = await navigator.permissions.query({ name: 'microphone' })
                micPermission.value = permStatus.state
                // Écouter les changements de permission
                permStatus.onchange = () => {
                    micPermission.value = permStatus.state
                }
                // Si déjà accordé, pas besoin de demander
                if (permStatus.state === 'granted') return
                // Si refusé, on ne peut pas re-demander
                if (permStatus.state === 'denied') return
            } catch (e) {
                // Permissions API peut ne pas supporter 'microphone' sur certains navigateurs
            }
        }

        // 2. Demander l'accès au micro via getUserMedia (déclenche le popup navigateur)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        // Succès : arrêter immédiatement le stream (on veut juste la permission)
        stream.getTracks().forEach(track => track.stop())
        micPermission.value = 'granted'
    } catch (err) {
        console.warn('Permission microphone refusée ou indisponible:', err.message)
        if (err.name === 'NotAllowedError') {
            micPermission.value = 'denied'
        } else if (err.name === 'NotFoundError') {
            micPermission.value = 'denied'
        }
    }
}

// ============================
// Permission Caméra & Capture Photo
// ============================
const cameraPermission = ref('prompt')
const showCameraCapture = ref(false)
const cameraVideoRef = ref(null)
const cameraStream = ref(null)
const cameraFacingMode = ref('environment') // 'environment' (arrière) ou 'user' (selfie)

const requestCameraPermission = async () => {
    try {
        if (navigator.permissions) {
            try {
                const permStatus = await navigator.permissions.query({ name: 'camera' })
                cameraPermission.value = permStatus.state
                permStatus.onchange = () => {
                    cameraPermission.value = permStatus.state
                }
            } catch (e) { /* Permissions API peut ne pas supporter 'camera' */ }
        }
    } catch (err) {
        console.warn('Permission caméra non vérifiable:', err.message)
    }
}

/**
 * Ouvrir la caméra pour capturer une photo
 * Utilise getUserMedia pour accéder au flux vidéo
 */
const openCameraCapture = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: cameraFacingMode.value,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        })
        cameraStream.value = stream
        cameraPermission.value = 'granted'
        showCameraCapture.value = true
        await nextTick()
        if (cameraVideoRef.value) {
            cameraVideoRef.value.srcObject = stream
            cameraVideoRef.value.play()
        }
    } catch (err) {
        console.error('Erreur accès caméra:', err)
        if (err.name === 'NotAllowedError') {
            cameraPermission.value = 'denied'
        } else if (err.name === 'NotFoundError') {
            dictationError.value = '⚠️ Aucune caméra détectée sur cet appareil.'
            setTimeout(() => dictationError.value = '', 4000)
        }
    }
}

/**
 * Basculer entre caméra avant (selfie) et arrière
 */
const switchCamera = async () => {
    cameraFacingMode.value = cameraFacingMode.value === 'environment' ? 'user' : 'environment'
    closeCameraCapture()
    await nextTick()
    openCameraCapture()
}

/**
 * Capturer la photo depuis le flux vidéo via Canvas
 */
const capturePhoto = () => {
    if (!cameraVideoRef.value) return
    const video = cameraVideoRef.value
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    // Miroir horizontal pour la caméra selfie
    if (cameraFacingMode.value === 'user') {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    form.value.preview = dataUrl
    form.value.image = dataUrl
    closeCameraCapture()
}

/**
 * Fermer la caméra et libérer le flux
 */
const closeCameraCapture = () => {
    if (cameraStream.value) {
        cameraStream.value.getTracks().forEach(track => track.stop())
        cameraStream.value = null
    }
    showCameraCapture.value = false
}

// ============================
// Permission Géolocalisation & GPS
// ============================
const geoPermission = ref('prompt')
const isLocatingGPS = ref(false)

const requestGeoPermission = async () => {
    try {
        if (navigator.permissions) {
            try {
                const permStatus = await navigator.permissions.query({ name: 'geolocation' })
                geoPermission.value = permStatus.state
                permStatus.onchange = () => {
                    geoPermission.value = permStatus.state
                }
            } catch (e) { /* Ignore */ }
        }
    } catch (err) {
        console.warn('Permission géolocalisation non vérifiable:', err.message)
    }
}

/**
 * Utiliser le GPS de l'appareil pour obtenir la position actuelle
 * + géocodage inverse via Nominatim pour remplir le nom du lieu
 */
const useMyGPSLocation = () => {
    if (!navigator.geolocation) {
        dictationError.value = '⚠️ Géolocalisation non supportée sur cet appareil.'
        setTimeout(() => dictationError.value = '', 4000)
        return
    }
    isLocatingGPS.value = true
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            form.value.coords.lat = parseFloat(position.coords.latitude.toFixed(6))
            form.value.coords.lng = parseFloat(position.coords.longitude.toFixed(6))
            geoPermission.value = 'granted'
            // Géocodage inverse pour obtenir le nom de l'adresse
            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&accept-language=fr`,
                    { headers: { 'User-Agent': 'BabiVibes-PWA/1.0' } }
                )
                if (response.ok) {
                    const data = await response.json()
                    if (data.display_name) {
                        form.value.location = data.display_name.split(',').slice(0, 3).join(',').trim()
                    }
                }
            } catch (e) {
                console.warn('Reverse geocode failed:', e)
            }
            isLocatingGPS.value = false
        },
        (error) => {
            console.error('Erreur GPS:', error)
            isLocatingGPS.value = false
            if (error.code === error.PERMISSION_DENIED) {
                geoPermission.value = 'denied'
                dictationError.value = '📍 Accès à la localisation refusé. Autorisez la géolocalisation dans les paramètres du navigateur.'
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                dictationError.value = '📍 Position GPS indisponible.'
            } else {
                dictationError.value = '📍 Délai de géolocalisation dépassé.'
            }
            setTimeout(() => dictationError.value = '', 4000)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
}

// State
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingEvent = ref(null)
const deleteConfirmId = ref(null)

// Form data
const defaultForm = () => ({
    title: '',
    description: '',
    date: new Date().toISOString().slice(0, 16),
    location: '',
    organizer: '',
    image: '',
    preview: '',
    coords: { lat: 5.30966, lng: -3.97449 },
    isPremium: false,
    price: 0,
    features: [],
    backgroundMusic: '',
    musicTitle: '',
    promoText: ''
})

const form = ref(defaultForm())

// Events list — filtré par utilisateur, trié par date (plus récent en premier)
const events = computed(() => {
    let list
    if (!isOrganizerMode.value) {
        // Admin voit tout
        list = [...eventStore.events]
    } else {
        // Organisateur : ne voit que ses propres événements
        const u = userStore.user
        if (!u) return []
        const names = [u.organizerName, u.spaceName, u.name].filter(Boolean).map(n => n.toLowerCase())
        list = eventStore.events.filter(e => {
            // Match par created_by (user ID) si disponible
            if (e.createdBy && u.id && e.createdBy === u.id) return true
            // Match par nom d'organisateur
            const orgName = (e.organizer || '').toLowerCase()
            return names.some(n => orgName === n || orgName.includes(n))
        })
    }
    // Tri chronologique : du plus récent au plus ancien
    return list.sort((a, b) => {
        const dateA = new Date(a.date || 0)
        const dateB = new Date(b.date || 0)
        return dateB - dateA
    })
})

// Handle logout / back
const handleLogout = () => {
    if (isOrganizerMode.value) {
        // Organisateur : retour au site
        router.push('/')
    } else {
        // Admin : déconnexion admin
        adminStore.logout()
        router.push('/admin')
    }
}

// Handle image selection
const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
            form.value.preview = ev.target.result
            form.value.image = ev.target.result
        }
        reader.readAsDataURL(file)
    }
}

// Open create modal
const openCreateModal = () => {
    form.value = defaultForm()
    // Auto-remplir l'organisateur si mode organisateur
    if (isOrganizerMode.value && userStore.user) {
        form.value.organizer = userStore.user.organizerName || userStore.user.spaceName || userStore.user.name || ''
    }
    showCreateModal.value = true
}

// Close modals
const closeModals = () => {
    showCreateModal.value = false
    showEditModal.value = false
    editingEvent.value = null
    form.value = defaultForm()
}

// Create event
const createEvent = async () => {
    await eventStore.addEvent({
        title: form.value.title || 'Événement Sans Titre',
        description: form.value.description || 'Pas de description',
        date: form.value.date,
        location: form.value.location || 'Abidjan',
        organizer: form.value.organizer || (isOrganizerMode.value ? (userStore.user?.organizerName || userStore.user?.spaceName || userStore.user?.name) : 'Admin'),
        image: form.value.image || form.value.preview,
        coords: form.value.coords,
        isPremium: form.value.isPremium,
        price: form.value.isPremium ? form.value.price : 0,
        features: form.value.features || [],
        backgroundMusic: form.value.backgroundMusic || '',
        musicTitle: form.value.musicTitle || '',
        promoText: form.value.promoText || '',
        createdBy: userStore.user?.id || null,
        distance: '0 km'
    })
    closeModals()
}

// Open edit modal
const openEditModal = (event) => {
    editingEvent.value = event
    form.value = {
        title: event.title,
        description: event.description,
        date: event.date ? event.date.slice(0, 16) : new Date().toISOString().slice(0, 16),
        location: event.location,
        organizer: event.organizer,
        image: event.image,
        preview: event.image,
        coords: event.coords || { lat: 5.30966, lng: -3.97449 },
        isPremium: event.isPremium || false,
        price: event.price || 0,
        features: event.features ? [...event.features] : [],
        backgroundMusic: event.backgroundMusic || '',
        musicTitle: event.musicTitle || '',
        promoText: event.promoText || ''
    }
    showEditModal.value = true
}

// Update event
const updateEvent = async () => {
    if (editingEvent.value) {
        await eventStore.updateEvent(editingEvent.value.id, {
            title: form.value.title,
            description: form.value.description,
            date: form.value.date,
            location: form.value.location,
            organizer: form.value.organizer,
            image: form.value.image || form.value.preview,
            coords: form.value.coords,
            isPremium: form.value.isPremium,
            price: form.value.isPremium ? form.value.price : 0,
            features: form.value.features || [],
            backgroundMusic: form.value.backgroundMusic || '',
            musicTitle: form.value.musicTitle || '',
            promoText: form.value.promoText || ''
        })
        closeModals()
    }
}

// Delete event
const confirmDelete = (eventId) => {
    deleteConfirmId.value = eventId
}

const cancelDelete = () => {
    deleteConfirmId.value = null
}

const deleteEvent = (eventId) => {
    eventStore.deleteEvent(eventId)
    deleteConfirmId.value = null
}

// Format date for display
const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

// ============================
// Features / Tags Management
// ============================
const predefinedTags = [
    'VIP Access', 'Free Drink', 'Photo Booth', 'Live DJ',
    'Open Bar', 'Dress Code', 'Parking', 'Guest List',
    'After Party', 'Buffet', 'Piscine', 'Jeux'
]
const customTagInput = ref('')

const toggleTag = (tag) => {
    const idx = form.value.features.indexOf(tag)
    if (idx >= 0) {
        form.value.features.splice(idx, 1)
    } else {
        form.value.features.push(tag)
    }
}

const addCustomTag = () => {
    const tag = customTagInput.value.trim()
    if (tag && !form.value.features.includes(tag)) {
        form.value.features.push(tag)
    }
    customTagInput.value = ''
}

const removeTag = (index) => {
    form.value.features.splice(index, 1)
}

// ============================
// Speech-to-Text (Web Speech API)
// ============================
const isRecording = ref(false)
const recordingField = ref('')
const speechSupported = ref(false)
const dictationError = ref('')

// Vérifier le support de la reconnaissance vocale
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
if (SpeechRecognition) {
    speechSupported.value = true
}

/**
 * Démarrer la dictée vocale pour un champ donné
 * @param {string} field - Le nom du champ du formulaire (title, description, location, organizer)
 */
const startDictation = async (field) => {
    dictationError.value = ''

    if (!SpeechRecognition) {
        dictationError.value = '⚠️ Reconnaissance vocale non supportée. Utilisez Chrome ou Edge.'
        setTimeout(() => dictationError.value = '', 4000)
        return
    }

    // Vérifier le contexte sécurisé (HTTPS ou localhost requis)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        dictationError.value = '⚠️ La dictée vocale nécessite HTTPS. Sur téléphone, utilisez le déploiement Netlify.'
        setTimeout(() => dictationError.value = '', 5000)
        return
    }

    // Vérifier/demander la permission micro si pas encore accordée
    if (micPermission.value !== 'granted') {
        await requestMicPermission()
        if (micPermission.value === 'denied') {
            dictationError.value = '🎤 Accès au micro refusé. Autorisez le micro dans les paramètres du navigateur puis rechargez.'
            setTimeout(() => dictationError.value = '', 5000)
            return
        }
    }

    // Si on enregistre déjà pour ce champ, on arrête
    if (isRecording.value && recordingField.value === field) {
        stopDictation()
        return
    }

    // Arrêter toute dictée en cours avant d'en démarrer une nouvelle
    stopDictation()

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.lang = 'fr-FR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    // Sauvegarder le texte existant avant la dictée
    const baseText = field === 'customTag' ? '' : (form.value[field] || '')

    isRecording.value = true
    recordingField.value = field

    recognition.onresult = (event) => {
        const result = event.results[0]
        if (result && result[0]) {
            const transcript = result[0].transcript.trim()
            if (transcript) {
                if (field === 'customTag') {
                    // Cas spécial : ajouter directement comme tag
                    const tag = transcript.charAt(0).toUpperCase() + transcript.slice(1)
                    if (!form.value.features.includes(tag)) {
                        form.value.features.push(tag)
                    }
                    customTagInput.value = ''
                } else {
                    // Ajouter au contenu existant ou remplacer si vide
                    form.value[field] = baseText ? (baseText + ' ' + transcript) : transcript
                }
            }
        }
    }

    recognition.onerror = (event) => {
        console.error('Erreur reconnaissance vocale:', event.error)
        isRecording.value = false
        recordingField.value = ''
        
        if (event.error === 'not-allowed') {
            dictationError.value = '🎤 Accès au micro refusé. Autorisez le micro dans les paramètres du navigateur.'
        } else if (event.error === 'no-speech') {
            dictationError.value = '🔇 Aucune voix détectée. Parlez plus fort et réessayez.'
        } else if (event.error === 'network') {
            dictationError.value = '📡 Erreur réseau. La reconnaissance vocale nécessite une connexion internet.'
        } else {
            dictationError.value = `⚠️ Erreur: ${event.error}`
        }
        setTimeout(() => dictationError.value = '', 4000)
    }

    recognition.onend = () => {
        isRecording.value = false
        recordingField.value = ''
    }

    try {
        recognition.start()
        window._currentRecognition = recognition
    } catch (e) {
        console.error('Erreur démarrage reconnaissance:', e)
        isRecording.value = false
        recordingField.value = ''
        dictationError.value = '⚠️ Impossible de démarrer la reconnaissance vocale.'
        setTimeout(() => dictationError.value = '', 4000)
    }
}

const stopDictation = () => {
    if (window._currentRecognition) {
        try {
            window._currentRecognition.stop()
        } catch (e) { /* ignore */ }
        window._currentRecognition = null
    }
    isRecording.value = false
    recordingField.value = ''
}

/**
 * Text-to-Speech : lire un texte à haute voix en français
 * Utilise l'API Web Speech Synthesis (supporté par Edge, Chrome, etc.)
 */
const speakText = (text) => {
    if (!text) return
    if ('speechSynthesis' in window) {
        // Annuler toute synthèse en cours
        window.speechSynthesis.cancel()
        
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = 'fr-FR'
        utterance.rate = 1.0
        utterance.pitch = 1.0
        
        // Essayer de trouver une voix française Microsoft Edge
        const voices = window.speechSynthesis.getVoices()
        const frenchVoice = voices.find(v => v.lang.startsWith('fr') && v.name.includes('Microsoft'))
            || voices.find(v => v.lang.startsWith('fr'))
        if (frenchVoice) {
            utterance.voice = frenchVoice
        }
        
        window.speechSynthesis.speak(utterance)
    }
}
// ============================
// Géocodage OSM Nominatim
// ============================
const locationSuggestions = ref([])
const isSearchingLocation = ref(false)
const showSuggestions = ref(false)
let searchTimeout = null

/**
 * Rechercher des lieux via Nominatim (OpenStreetMap)
 * Biaisé vers Abidjan / Côte d'Ivoire
 */
const searchLocation = async (query) => {
    if (!query || query.length < 3) {
        locationSuggestions.value = []
        showSuggestions.value = false
        return
    }

    isSearchingLocation.value = true
    try {
        const params = new URLSearchParams({
            q: query + ', Côte d\'Ivoire',
            format: 'json',
            limit: '6',
            addressdetails: '1',
            'accept-language': 'fr',
            countrycodes: 'ci',
            viewbox: '-5.6,4.3,-3.0,7.6', // Bounding box Côte d'Ivoire
            bounded: '0' // Préférer mais pas limiter
        })

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?${params}`,
            {
                headers: {
                    'User-Agent': 'BabiVibes-PWA/1.0'
                }
            }
        )

        if (!response.ok) throw new Error('Nominatim error')

        const results = await response.json()
        locationSuggestions.value = results.map(r => ({
            display: r.display_name,
            short: formatNominatimName(r),
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            type: r.type,
            address: r.address
        }))
        showSuggestions.value = locationSuggestions.value.length > 0
    } catch (err) {
        console.error('Erreur géocodage Nominatim:', err)
        locationSuggestions.value = []
    } finally {
        isSearchingLocation.value = false
    }
}

/**
 * Formater le nom court d'un résultat Nominatim
 */
const formatNominatimName = (result) => {
    const addr = result.address || {}
    const parts = []
    // Nom du lieu
    if (addr.amenity) parts.push(addr.amenity)
    else if (addr.leisure) parts.push(addr.leisure)
    else if (addr.tourism) parts.push(addr.tourism)
    else if (addr.building) parts.push(addr.building)
    else if (addr.road) parts.push(addr.road)
    
    // Quartier / suburb
    if (addr.suburb) parts.push(addr.suburb)
    else if (addr.neighbourhood) parts.push(addr.neighbourhood)
    
    // Ville
    if (addr.city) parts.push(addr.city)
    else if (addr.town) parts.push(addr.town)
    else if (addr.village) parts.push(addr.village)
    
    // Commune
    if (addr.county) parts.push(addr.county)

    return parts.length > 0 ? parts.join(', ') : result.display_name.split(',').slice(0, 3).join(',')
}

/**
 * Sélectionner une suggestion : remplir le lieu et les coordonnées
 */
const selectLocation = (suggestion) => {
    form.value.location = suggestion.short
    form.value.coords.lat = suggestion.lat
    form.value.coords.lng = suggestion.lng
    showSuggestions.value = false
    locationSuggestions.value = []
}

/**
 * Debounce : déclencher la recherche après 400ms de saisie
 */
const onLocationInput = () => {
    if (searchTimeout) clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
        searchLocation(form.value.location)
    }, 400)
}

/**
 * Fermer les suggestions quand on clique ailleurs
 */
const closeSuggestions = () => {
    // Petit délai pour permettre le clic sur une suggestion
    setTimeout(() => {
        showSuggestions.value = false
    }, 200)
}

// Cleanup au démontage
onUnmounted(() => {
    if (searchTimeout) clearTimeout(searchTimeout)
    stopDictation()
    closeCameraCapture()
    if (mapPickerInstance) {
        mapPickerInstance.remove()
        mapPickerInstance = null
    }
})

// ============================
// Carte OSM Interactive (Map Picker)
// ============================
const showMapPicker = ref(false)
const mapPickerContainer = ref(null)
let mapPickerInstance = null
let mapPickerMarker = null

const openMapPicker = () => {
    showMapPicker.value = true
    nextTick(() => initMapPicker())
}

const closeMapPicker = () => {
    showMapPicker.value = false
    if (mapPickerInstance) {
        mapPickerInstance.remove()
        mapPickerInstance = null
    }
}

const initMapPicker = () => {
    if (!mapPickerContainer.value) return
    if (mapPickerInstance) {
        mapPickerInstance.remove()
    }

    const center = [form.value.coords.lat || 5.30966, form.value.coords.lng || -3.97449]
    const zoom = (form.value.coords.lat !== 5.30966 || form.value.coords.lng !== -3.97449) ? 16 : 13

    mapPickerInstance = L.map(mapPickerContainer.value).setView(center, zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mapPickerInstance)

    // Marqueur draggable
    const markerIcon = L.divIcon({
        className: 'map-picker-marker',
        html: '<div style="background:#FFD700;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">📍</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    })

    mapPickerMarker = L.marker(center, { 
        icon: markerIcon, 
        draggable: true 
    }).addTo(mapPickerInstance)

    // Mise à jour au drag
    mapPickerMarker.on('dragend', () => {
        const pos = mapPickerMarker.getLatLng()
        form.value.coords.lat = parseFloat(pos.lat.toFixed(6))
        form.value.coords.lng = parseFloat(pos.lng.toFixed(6))
    })

    // Clic sur la carte = déplacer le marqueur
    mapPickerInstance.on('click', (e) => {
        mapPickerMarker.setLatLng(e.latlng)
        form.value.coords.lat = parseFloat(e.latlng.lat.toFixed(6))
        form.value.coords.lng = parseFloat(e.latlng.lng.toFixed(6))
    })

    // Fix tile rendering after accordion open
    setTimeout(() => {
        if (mapPickerInstance) {
            mapPickerInstance.invalidateSize()
        }
    }, 300)
    setTimeout(() => {
        if (mapPickerInstance) {
            mapPickerInstance.invalidateSize()
        }
    }, 600)
}

const confirmMapPosition = () => {
    closeMapPicker()
}

/**
 * Extraire l'ID d'une vidéo YouTube depuis une URL
 */
const extractYouTubeId = (url) => {
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
 * Récupérer automatiquement le titre d'une vidéo YouTube via oEmbed
 * Pas besoin de clé API — endpoint public
 */
const isFetchingTitle = ref(false)
let fetchTitleTimeout = null

const fetchYouTubeTitle = async (url) => {
    const videoId = extractYouTubeId(url)
    if (!videoId) return

    // Ne pas écraser si l'utilisateur a déjà saisi un titre manuellement
    if (form.value.musicTitle && form.value.musicTitle.trim() !== '') return

    isFetchingTitle.value = true
    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        const response = await fetch(oembedUrl)
        if (response.ok) {
            const data = await response.json()
            if (data.title && (!form.value.musicTitle || form.value.musicTitle.trim() === '')) {
                form.value.musicTitle = data.title
            }
        }
    } catch (err) {
        console.warn('Impossible de récupérer le titre YouTube:', err)
    } finally {
        isFetchingTitle.value = false
    }
}

// Watcher : auto-fetch le titre quand l'URL YouTube change
watch(() => form.value.backgroundMusic, (newUrl) => {
    if (fetchTitleTimeout) clearTimeout(fetchTitleTimeout)
    if (newUrl && extractYouTubeId(newUrl)) {
        fetchTitleTimeout = setTimeout(() => fetchYouTubeTitle(newUrl), 600)
    }
})
</script>

<template>
  <div class="min-h-screen bg-black">
    <!-- Header -->
    <header class="bg-surface border-b border-gray-800 px-4 py-3 sticky top-0 z-40">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center gap-3">
          <Store v-if="isOrganizerMode" class="w-5 h-5 text-primary" />
          <h1 class="text-xl font-bold text-primary">
            {{ isOrganizerMode ? (userStore.user?.spaceName || 'Mon Espace') : 'Admin Dashboard' }}
          </h1>
        </div>
        <div class="flex items-center gap-4">
          <router-link to="/" class="text-gray-400 text-sm hover:text-white transition flex items-center gap-1">
            <ArrowLeft class="w-4 h-4" />
            {{ isOrganizerMode ? 'Retour au profil' : 'Voir le site' }}
          </router-link>
          <button @click="handleLogout" class="flex items-center gap-2 transition" :class="isOrganizerMode ? 'text-gray-400 hover:text-white' : 'text-red-400 hover:text-red-300'">
            <LogOut v-if="!isOrganizerMode" class="w-4 h-4" />
            <ArrowLeft v-if="isOrganizerMode" class="w-4 h-4" />
            {{ isOrganizerMode ? 'Fermer' : 'Déconnexion' }}
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto p-4">
      <!-- Permission Banners -->
      <div v-if="micPermission === 'denied'" class="mb-3 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 p-3 rounded-xl text-sm flex items-center gap-2">
        <MicOff class="w-5 h-5 flex-shrink-0" />
        <span>🎤 Accès au microphone refusé. Autorisez le micro dans les paramètres du navigateur puis rechargez la page.</span>
      </div>
      <div v-if="cameraPermission === 'denied'" class="mb-3 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 p-3 rounded-xl text-sm flex items-center gap-2">
        <CameraOff class="w-5 h-5 flex-shrink-0" />
        <span>📷 Accès à la caméra refusé. Autorisez la caméra dans les paramètres du navigateur puis rechargez la page.</span>
      </div>
      <div v-if="geoPermission === 'denied'" class="mb-3 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 p-3 rounded-xl text-sm flex items-center gap-2">
        <MapPin class="w-5 h-5 flex-shrink-0" />
        <span>📍 Accès à la géolocalisation refusé. Autorisez la localisation dans les paramètres du navigateur puis rechargez la page.</span>
      </div>

      <!-- Stats & Actions -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 class="text-2xl font-bold text-white">Gestion des Événements</h2>
          <p class="text-gray-400">{{ events.length }} événement(s) au total</p>
        </div>
        <div class="flex items-center gap-3">
          <button 
            @click="openCreateModal"
            class="bg-primary text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition"
          >
            <Plus class="w-5 h-5" />
            Nouvel Événement
          </button>
          <router-link 
            to="/admin/ads" 
            class="bg-yellow-400 text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-yellow-500 transition"
          >
            <Megaphone class="w-5 h-5" />
            Publicités
          </router-link>
        </div>
      </div>

      <!-- Events Grid -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div 
          v-for="event in events" 
          :key="event.id"
          class="bg-surface rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition"
        >
          <img :src="event.image" :alt="event.title" class="w-full h-40 object-cover" />
          <div class="p-4">
            <h3 class="font-bold text-white truncate">{{ event.title }}</h3>
            <div class="flex items-center gap-2 text-gray-400 text-sm mt-1">
              <Calendar class="w-4 h-4" />
              {{ formatDate(event.date) }}
            </div>
            <div class="flex items-center gap-2 text-gray-400 text-sm mt-1">
              <MapPin class="w-4 h-4" />
              {{ event.location }}
            </div>
            <div v-if="event.isPremium" class="mt-2">
              <span class="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">Premium - {{ event.price }} CFA</span>
            </div>
            
            <!-- Actions -->
            <div class="flex gap-2 mt-4">
              <button 
                @click="openEditModal(event)"
                class="flex-1 bg-gray-800 text-white py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-gray-700 transition"
              >
                <Edit class="w-4 h-4" />
                Modifier
              </button>
              <button 
                v-if="deleteConfirmId !== event.id"
                @click="confirmDelete(event.id)"
                class="bg-red-500/20 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/30 transition"
              >
                <Trash2 class="w-4 h-4" />
              </button>
              <div v-else class="flex gap-1">
                <button 
                  @click="deleteEvent(event.id)"
                  class="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition"
                >
                  <Check class="w-4 h-4" />
                </button>
                <button 
                  @click="cancelDelete"
                  class="bg-gray-700 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="events.length === 0" class="text-center py-16">
        <p class="text-gray-400 text-lg mb-4">Aucun événement pour le moment</p>
        <button 
          @click="openCreateModal"
          class="bg-primary text-black font-bold px-6 py-3 rounded-xl inline-flex items-center gap-2 hover:bg-primary/90 transition"
        >
          <Plus class="w-5 h-5" />
          Créer le premier événement
        </button>
      </div>
    </main>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div 
        v-if="showCreateModal || showEditModal" 
        class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        @click.self="closeModals"
      >
        <div class="bg-surface rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="p-4 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-surface">
            <h3 class="text-xl font-bold text-white">
              {{ showEditModal ? 'Modifier l\'événement' : 'Nouvel Événement' }}
            </h3>
            <button @click="closeModals" class="text-gray-400 hover:text-white transition">
              <X class="w-6 h-6" />
            </button>
          </div>

          <form @submit.prevent="showEditModal ? updateEvent() : createEvent()" class="p-4 space-y-4">
            <!-- Dictation Error Message -->
            <div v-if="dictationError" class="bg-red-500/20 text-red-400 text-sm p-3 rounded-xl text-center font-medium animate-pulse">
              {{ dictationError }}
            </div>

            <!-- Recording Indicator -->
            <div v-if="isRecording" class="bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl text-center flex items-center justify-center gap-2">
              <span class="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              🎤 Parlez maintenant... (champ : {{ recordingField === 'title' ? 'Titre' : recordingField === 'description' ? 'Description' : recordingField === 'location' ? 'Lieu' : recordingField === 'organizer' ? 'Organisateur' : recordingField === 'musicTitle' ? 'Titre musique' : recordingField === 'customTag' ? 'Tag' : recordingField }})
            </div>

            <!-- Image -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Image de l'événement</label>
              <!-- Preview si image sélectionnée -->
              <div v-if="form.preview" class="relative w-full h-40 bg-gray-900 border-2 border-gray-700 rounded-xl overflow-hidden mb-2">
                <img :src="form.preview" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="form.preview = ''; form.image = ''"
                  class="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-red-500/80 transition"
                  title="Supprimer l'image"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
              <!-- Boutons de sélection : Fichier + Caméra -->
              <div v-if="!form.preview" class="w-full h-40 bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl overflow-hidden flex flex-col items-center justify-center gap-3">
                <Camera class="w-8 h-8 text-gray-600" />
                <div class="flex gap-3">
                  <label class="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg cursor-pointer hover:bg-gray-700 hover:text-primary transition flex items-center gap-2 text-sm font-medium">
                    <Plus class="w-4 h-4" />
                    Choisir un fichier
                    <input type="file" accept="image/*" @change="handleImageChange" class="hidden" />
                  </label>
                  <button
                    type="button"
                    @click="openCameraCapture"
                    class="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-700 hover:text-primary transition flex items-center gap-2 text-sm font-medium"
                  >
                    <Video class="w-4 h-4" />
                    Prendre une photo
                  </button>
                </div>
              </div>
              <!-- Boutons de remplacement si image déjà présente -->
              <div v-if="form.preview" class="flex gap-2">
                <label class="flex-1 bg-gray-800 text-gray-300 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-700 hover:text-primary transition flex items-center justify-center gap-2 text-sm">
                  <Plus class="w-4 h-4" />
                  Remplacer (fichier)
                  <input type="file" accept="image/*" @change="handleImageChange" class="hidden" />
                </label>
                <button
                  type="button"
                  @click="openCameraCapture"
                  class="flex-1 bg-gray-800 text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-700 hover:text-primary transition flex items-center justify-center gap-2 text-sm"
                >
                  <Video class="w-4 h-4" />
                  Remplacer (caméra)
                </button>
              </div>
            </div>

            <!-- Title -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Titre *</label>
              <div class="flex gap-2">
                <input 
                  v-model="form.title" 
                  type="text" 
                  placeholder="Ex: Soirée Coupé Décalé"
                  class="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                  required
                />
                <button 
                  type="button"
                  @click="startDictation('title')"
                  class="px-3 rounded-xl transition flex items-center justify-center"
                  :class="isRecording && recordingField === 'title' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700'"
                  :title="isRecording && recordingField === 'title' ? 'Arrêter' : 'Dicter le titre'"
                >
                  <Mic v-if="!(isRecording && recordingField === 'title')" class="w-5 h-5" />
                  <MicOff v-else class="w-5 h-5" />
                </button>
                <button 
                  v-if="form.title"
                  type="button"
                  @click="speakText(form.title)"
                  class="px-3 bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700 rounded-xl transition flex items-center justify-center"
                  title="Écouter le titre"
                >
                  <Volume2 class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Date -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Date et heure *</label>
              <input 
                v-model="form.date" 
                type="datetime-local"
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                required
              />
            </div>

            <!-- Location with OSM Autocomplete -->
            <div class="relative">
              <label class="block text-gray-400 text-sm mb-2">Lieu <span class="text-gray-600 text-xs">(tapez pour rechercher sur OpenStreetMap)</span></label>
              <div class="flex gap-2">
                <div class="flex-1 relative">
                  <input 
                    v-model="form.location" 
                    type="text" 
                    placeholder="Ex: Cocody, Zone 4, Sofitel..."
                    class="w-full bg-gray-900 text-white px-4 py-3 pr-10 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                    @input="onLocationInput"
                    @focus="form.location && form.location.length >= 3 && locationSuggestions.length > 0 ? showSuggestions = true : null"
                    @blur="closeSuggestions"
                    autocomplete="off"
                  />
                  <!-- Search/Loading icon inside input -->
                  <div class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                    <Loader2 v-if="isSearchingLocation" class="w-4 h-4 animate-spin" />
                    <Search v-else class="w-4 h-4" />
                  </div>
                </div>
                <button 
                  type="button"
                  @click="startDictation('location')"
                  class="px-3 rounded-xl transition flex items-center justify-center"
                  :class="isRecording && recordingField === 'location' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700'"
                  :title="isRecording && recordingField === 'location' ? 'Arrêter' : 'Dicter le lieu'"
                >
                  <Mic v-if="!(isRecording && recordingField === 'location')" class="w-5 h-5" />
                  <MicOff v-else class="w-5 h-5" />
                </button>
                <button 
                  v-if="form.location"
                  type="button"
                  @click="speakText(form.location)"
                  class="px-3 bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700 rounded-xl transition flex items-center justify-center"
                  title="Écouter le lieu"
                >
                  <Volume2 class="w-5 h-5" />
                </button>
              </div>

              <!-- Suggestions dropdown -->
              <div 
                v-if="showSuggestions && locationSuggestions.length > 0" 
                class="absolute z-50 left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto"
              >
                <button 
                  v-for="(suggestion, index) in locationSuggestions" 
                  :key="index"
                  type="button"
                  @mousedown.prevent="selectLocation(suggestion)"
                  class="w-full text-left px-4 py-3 hover:bg-gray-800 transition border-b border-gray-800 last:border-0 flex items-start gap-3"
                >
                  <MapPin class="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div class="min-w-0">
                    <p class="text-white text-sm font-medium truncate">{{ suggestion.short }}</p>
                    <p class="text-gray-500 text-xs truncate">{{ suggestion.display }}</p>
                    <p class="text-gray-600 text-xs mt-0.5">
                      <Navigation class="w-3 h-3 inline" /> {{ suggestion.lat.toFixed(4) }}, {{ suggestion.lng.toFixed(4) }}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <!-- Organizer -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Organisateur</label>
              <div class="flex gap-2">
                <input 
                  v-model="form.organizer" 
                  type="text" 
                  placeholder="Ex: Babi Event"
                  class="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                />
                <button 
                  type="button"
                  @click="startDictation('organizer')"
                  class="px-3 rounded-xl transition flex items-center justify-center"
                  :class="isRecording && recordingField === 'organizer' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700'"
                  :title="isRecording && recordingField === 'organizer' ? 'Arrêter' : 'Dicter l\'organisateur'"
                >
                  <Mic v-if="!(isRecording && recordingField === 'organizer')" class="w-5 h-5" />
                  <MicOff v-else class="w-5 h-5" />
                </button>
                <button 
                  v-if="form.organizer"
                  type="button"
                  @click="speakText(form.organizer)"
                  class="px-3 bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700 rounded-xl transition flex items-center justify-center"
                  title="Écouter l'organisateur"
                >
                  <Volume2 class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Description -->
            <div>
              <div class="flex justify-between items-center mb-2">
                <label class="block text-gray-400 text-sm">Description</label>
                <div class="flex gap-1">
                  <button 
                    type="button"
                    @click="startDictation('description')"
                    class="p-1.5 rounded-lg transition flex items-center justify-center"
                    :class="isRecording && recordingField === 'description' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700'"
                    :title="isRecording && recordingField === 'description' ? 'Arrêter' : 'Dicter la description'"
                  >
                    <Mic v-if="!(isRecording && recordingField === 'description')" class="w-4 h-4" />
                    <MicOff v-else class="w-4 h-4" />
                  </button>
                  <button 
                    v-if="form.description"
                    type="button"
                    @click="speakText(form.description)"
                    class="p-1.5 bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700 rounded-lg transition flex items-center justify-center"
                    title="Écouter la description"
                  >
                    <Volume2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <textarea 
                v-model="form.description" 
                rows="3"
                placeholder="Décrivez votre événement... ou cliquez sur 🎤 pour dicter"
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition resize-none"
              ></textarea>
            </div>

            <!-- Premium Toggle -->
            <div class="flex items-center gap-3">
              <input 
                v-model="form.isPremium" 
                type="checkbox" 
                id="isPremium"
                class="w-5 h-5 rounded bg-gray-900 border-gray-700 text-primary focus:ring-primary"
              />
              <label for="isPremium" class="text-white">Événement Premium</label>
            </div>

            <!-- Price (if premium) -->
            <div v-if="form.isPremium">
              <label class="block text-gray-400 text-sm mb-2">Prix (CFA)</label>
              <input 
                v-model.number="form.price" 
                type="number" 
                min="0"
                placeholder="Ex: 5000"
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
              />
            </div>

            <!-- Features / Tags -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">
                <Tag class="w-4 h-4 inline" /> Tags / Features
              </label>
              <!-- Tags prédéfinis -->
              <div class="flex flex-wrap gap-2 mb-3">
                <button 
                  v-for="tag in predefinedTags" 
                  :key="tag"
                  type="button"
                  @click="toggleTag(tag)"
                  class="px-3 py-1.5 rounded-full text-xs font-medium transition border"
                  :class="form.features.includes(tag) 
                    ? 'bg-primary/20 text-primary border-primary/50' 
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'"
                >
                  {{ form.features.includes(tag) ? '✓' : '+' }} {{ tag }}
                </button>
              </div>
              <!-- Saisie libre de tag -->
              <div class="flex gap-2">
                <input 
                  v-model="customTagInput" 
                  type="text" 
                  placeholder="Ajouter un tag personnalisé..."
                  class="flex-1 bg-gray-900 text-white px-4 py-2.5 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition text-sm"
                  @keydown.enter.prevent="addCustomTag"
                />
                <button 
                  type="button"
                  @click="addCustomTag"
                  class="px-3 bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700 rounded-xl transition flex items-center justify-center"
                  title="Ajouter le tag"
                >
                  <Plus class="w-5 h-5" />
                </button>
                <button 
                  type="button"
                  @click="startDictation('customTag')"
                  class="px-3 rounded-xl transition flex items-center justify-center"
                  :class="isRecording && recordingField === 'customTag' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700'"
                  :title="isRecording && recordingField === 'customTag' ? 'Arrêter' : 'Dicter un tag'"
                >
                  <Mic v-if="!(isRecording && recordingField === 'customTag')" class="w-5 h-5" />
                  <MicOff v-else class="w-5 h-5" />
                </button>
              </div>
              <!-- Tags sélectionnés -->
              <div v-if="form.features.length > 0" class="flex flex-wrap gap-1.5 mt-3">
                <span 
                  v-for="(feature, idx) in form.features" 
                  :key="idx"
                  class="bg-primary/20 text-primary text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium"
                >
                  ✨ {{ feature }}
                  <button 
                    type="button" 
                    @click="removeTag(idx)" 
                    class="hover:text-red-400 transition"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </span>
              </div>
            </div>

            <!-- Background Music (YouTube) -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">🎵 Musique de fond <span class="text-gray-600 text-xs">(URL YouTube ou YouTube Shorts)</span></label>
              <input 
                v-model="form.backgroundMusic" 
                type="url" 
                placeholder="Ex: https://www.youtube.com/watch?v=... ou /shorts/..."
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
              />
              <!-- YouTube Preview -->
              <div v-if="form.backgroundMusic && extractYouTubeId(form.backgroundMusic)" class="mt-2 rounded-xl overflow-hidden border border-gray-700">
                <iframe 
                  :src="`https://www.youtube.com/embed/${extractYouTubeId(form.backgroundMusic)}?rel=0`"
                  class="w-full h-32"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
              <div v-if="form.backgroundMusic && !extractYouTubeId(form.backgroundMusic)" class="mt-1 text-red-400 text-xs">
                ⚠️ URL YouTube invalide. Formats acceptés : youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...
              </div>
            </div>

            <!-- Music Title -->
            <div v-if="form.backgroundMusic && extractYouTubeId(form.backgroundMusic)">
              <label class="block text-gray-400 text-sm mb-2">
                Titre de la musique <span class="text-gray-600 text-xs">(auto-rempli depuis YouTube)</span>
                <Loader2 v-if="isFetchingTitle" class="w-3 h-3 inline animate-spin text-primary ml-1" />
              </label>
              <div class="flex gap-2">
                <input 
                  v-model="form.musicTitle" 
                  type="text" 
                  :placeholder="isFetchingTitle ? 'Récupération du titre...' : 'Ex: DJ Arafat - Dosabado'"
                  class="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                />
                <button 
                  type="button"
                  @click="startDictation('musicTitle')"
                  class="px-3 rounded-xl transition flex items-center justify-center"
                  :class="isRecording && recordingField === 'musicTitle' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700'"
                  :title="isRecording && recordingField === 'musicTitle' ? 'Arrêter' : 'Dicter le titre de la musique'"
                >
                  <Mic v-if="!(isRecording && recordingField === 'musicTitle')" class="w-5 h-5" />
                  <MicOff v-else class="w-5 h-5" />
                </button>
                <button 
                  v-if="form.musicTitle"
                  type="button"
                  @click="speakText(form.musicTitle)"
                  class="px-3 bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700 rounded-xl transition flex items-center justify-center"
                  title="Écouter le titre de la musique"
                >
                  <Volume2 class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Promotion / Texte promo -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">
                <Megaphone class="w-4 h-4 inline" /> Promotion <span class="text-gray-600 text-xs">(laisser vide si aucune)</span>
              </label>
              <div class="flex gap-2">
                <input 
                  v-model="form.promoText" 
                  type="text" 
                  placeholder="Ex: 2 achetées = 1 offerte, -20% Early Bird..."
                  class="flex-1 bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                />
                <button 
                  type="button"
                  @click="startDictation('promoText')"
                  class="px-3 rounded-xl transition flex items-center justify-center"
                  :class="isRecording && recordingField === 'promoText' ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400 hover:text-primary hover:bg-gray-700'"
                  :title="isRecording && recordingField === 'promoText' ? 'Arrêter' : 'Dicter la promotion'"
                >
                  <Mic v-if="!(isRecording && recordingField === 'promoText')" class="w-5 h-5" />
                  <MicOff v-else class="w-5 h-5" />
                </button>
              </div>
            </div>

            <!-- Coordinates — Carte OSM Interactive (Accordéon) -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-gray-400 text-sm">📍 Localisation sur la carte</label>
                <span v-if="form.coords.lat !== 5.30966 || form.coords.lng !== -3.97449" class="text-xs text-green-400 flex items-center gap-1">
                  <Navigation class="w-3 h-3" /> Géolocalisé
                </span>
                <span v-else class="text-xs text-gray-600">Par défaut (Abidjan)</span>
              </div>
              <button 
                type="button"
                @click="showMapPicker ? closeMapPicker() : openMapPicker()"
                class="w-full bg-gray-900 border rounded-xl p-3 flex items-center justify-between transition"
                :class="showMapPicker ? 'border-primary' : 'border-gray-700 hover:border-primary'"
              >
                <div class="flex items-center gap-2 text-white text-sm">
                  <MapPin class="w-4 h-4 text-primary" />
                  <span v-if="form.coords.lat !== 5.30966 || form.coords.lng !== -3.97449">
                    {{ form.coords.lat.toFixed(5) }}, {{ form.coords.lng.toFixed(5) }}
                  </span>
                  <span v-else class="text-gray-500">Cliquer pour choisir sur la carte</span>
                </div>
                <span class="text-primary text-xs font-medium">{{ showMapPicker ? 'Fermer ✕' : 'Ouvrir la carte →' }}</span>
              </button>
              <!-- Map Accordion (inline) -->
              <div v-if="showMapPicker" class="mt-2 rounded-xl overflow-hidden border border-gray-700 relative z-0">
                <div ref="mapPickerContainer" class="w-full h-64 z-0"></div>
                <div class="p-2 bg-gray-900 flex items-center justify-between">
                  <p class="text-gray-500 text-[10px]">📍 Cliquez sur la carte ou déplacez le marqueur</p>
                  <button type="button" @click="confirmMapPosition" class="bg-primary text-black font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-primary/90 transition text-xs">
                    <Check class="w-3 h-3" />
                    Valider
                  </button>
                </div>
              </div>
            </div>

            <!-- Submit -->
            <button 
              type="submit"
              class="w-full bg-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition"
            >
              <Save class="w-5 h-5" />
              {{ showEditModal ? 'Enregistrer les modifications' : 'Créer l\'événement' }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>

  </div>
</template>
