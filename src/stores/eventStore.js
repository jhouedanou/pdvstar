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

    // Initialize with requested mock data
    events.value = [
        {
            id: '1',
            type: 'image',
            title: 'Soirée Concert Rumba chez Tonton Jules',
            date: new Date().toISOString(),
            image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1000&auto=format&fit=crop', // Night concert vibe
            organizer: 'Tonton Jules',
            location: 'Yopougon, Abidjan',
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
            distance: '3.5 km',
            description: 'Venez supporter les Éléphants ! Ambiance de feu garantie, maillots oranges exigés. 🇨🇮⚽',
            participantCount: 350,
            isRegistered: false
        }
    ]


    return { events, addEvent }
})
