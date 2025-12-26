import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEventStore = defineStore('events', () => {
    // Mock Data for MVP
    const events = ref([])

    const addEvent = (event) => {
        // Simulating backend ID generation
        event.id = Math.random().toString(36).substr(2, 9)
        event.date = new Date().toISOString() // Now
        // Add to top of feed
        events.value.unshift(event)
    }

    // Helper to generate random coordinates near Abidjan (Marcory Zone)
    // Center: 5.30966, -3.97449 (Marcory approx)
    const generateRandomLocation = () => {
        const centerLat = 5.30966
        const centerLng = -3.97449
        // Approx 1km variation
        const lat = centerLat + (Math.random() - 0.5) * 0.015
        const lng = centerLng + (Math.random() - 0.5) * 0.015
        return { lat, lng }
    }

    const eventTypes = ['Concert', 'Maquis', 'Bar', 'Boîte', 'Showcase']
    const adjectives = ['Enjaillement', 'Chill', 'Vibes', 'Night', 'Party']

    // Generate 20 Random Events
    const randomEvents = Array.from({ length: 20 }, (_, i) => {
        const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
        const coords = generateRandomLocation()

        return {
            id: `rnd-${i}`,
            type: 'image',
            title: `${type} ${adj} ${i + 1}`,
            date: new Date().toISOString(),
            image: `https://images.unsplash.com/photo-${1500000000000 + i}?q=80&w=500&auto=format&fit=crop`, // Random-ish unsplash ID approach or generic keywords
            // Using specific reliable keywords for better visuals
            image: i % 2 === 0
                ? 'https://images.unsplash.com/photo-1542396601-dca920ea2807?q=80&w=600' // Beer/Bar
                : 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600', // Party/Club
            organizer: `Organizer ${i}`,
            location: `Zone Marcory ${i}`,
            coords: coords, // { lat: ..., lng: ... }
            distance: `${(Math.random() * 2).toFixed(1)} km`,
            description: 'Venez vous amuser ! Ambiance garantie toute la nuit.',
            participantCount: Math.floor(Math.random() * 200),
            isRegistered: false
        }
    })

    // Initialize with requested mock data + Randoms
    events.value = [
        {
            id: '1',
            type: 'image',
            title: 'Soirée Concert Rumba chez Tonton Jules',
            date: new Date().toISOString(),
            image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1000&auto=format&fit=crop', // Night concert vibe
            organizer: 'Tonton Jules',
            location: 'Yopougon, Abidjan',
            coords: { lat: 5.30966, lng: -3.99 }, // Mock coords
            distance: '0.8 km',
            description: 'La meilleure Rumba de la ville ! Venez écouter les classiques dans une ambiance 100% locale. Bière glacée et poulet braisé au menu. 🍗🍺',
            participantCount: 42,
            isRegistered: false
        },
        {
            id: '2',
            type: 'image',
            title: 'Soirée DJ Mix à la Plage',
            date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
            image: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97d893?q=80&w=1000&auto=format&fit=crop', // Beach party
            organizer: 'Beach Club Étoile',
            location: 'Grand-Bassam',
            coords: { lat: 5.20, lng: -3.73 }, // Grand Bassam
            distance: '15 km',
            description: 'Les meilleurs DJ de la capitale mixent les hits Coupé-Décalé et Afrobeat les pieds dans le sable ! 🏖️🔥',
            participantCount: 128,
            isRegistered: false
        },
        {
            id: '3',
            type: 'image',
            title: 'Match CAN sur écran géant',
            date: new Date(Date.now() + 172800000).toISOString(), // +2 days
            image: 'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=1000&auto=format&fit=crop', // Soccer match crowd
            organizer: 'Fan Zone 225',
            location: 'Marcory, Abidjan',
            coords: { lat: 5.305, lng: -3.97 }, // Marcory
            distance: '3.5 km',
            description: 'Venez supporter les Éléphants ! Ambiance de feu garantie, maillots oranges exigés. 🇨🇮⚽',
            participantCount: 350,
            isRegistered: false
        },
        ...randomEvents
    ]


    return { events, addEvent }
})
