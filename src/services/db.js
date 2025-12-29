
import { useStorage } from '@vueuse/core'

class MockDB {
    constructor() {
        // Persistent storage using VueUse (wraps localStorage)
        // This acts as our "JSON Database"
        this.users = useStorage('pdvstar_db_users', [])
        this.events = useStorage('pdvstar_db_events', [])

        // Initialize with seed data if empty
        if (this.events.value.length === 0) {
            this.seedEvents()
        }
    }

    // --- USERS ---
    findUserByPhone(phone) {
        return this.users.value.find(u => u.phone === phone)
    }

    createUser(userData) {
        const newUser = {
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
            ...userData
        }
        this.users.value.push(newUser)
        return newUser
    }

    updateUser(id, updates) {
        const index = this.users.value.findIndex(u => u.id === id)
        if (index !== -1) {
            this.users.value[index] = { ...this.users.value[index], ...updates }
            return this.users.value[index]
        }
        return null
    }

    // --- EVENTS ---
    getEvents() {
        // Return reverse chronological (newest first)
        return [...this.events.value].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    }

    createEvent(eventData) {
        const newEvent = {
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
            participantCount: 0,
            isRegistered: false, // Per user session (simulated)
            ...eventData
        }
        // Add to beginning
        this.events.value.unshift(newEvent)
        return newEvent
    }

    updateEvent(id, updates) {
        const index = this.events.value.findIndex(e => e.id === id)
        if (index !== -1) {
            this.events.value[index] = { ...this.events.value[index], ...updates }
            return this.events.value[index]
        }
        return null
    }

    seedEvents() {
        const today = new Date()
        const initialEvents = [
            {
                id: '1',
                type: 'image',
                title: 'Soirée Concert Rumba chez Tonton Jules',
                date: new Date().toISOString(),
                image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1000&auto=format&fit=crop',
                organizer: 'Tonton Jules',
                location: 'Yopougon, Abidjan',
                coords: { lat: 5.30966, lng: -3.99 },
                distance: '0.8 km',
                description: 'La meilleure Rumba de la ville ! Venez écouter les classiques dans une ambiance 100% locale.',
                participantCount: 42
            },
            {
                id: '2',
                type: 'image',
                title: 'Soirée DJ Mix à la Plage',
                date: new Date(today.getTime() + 86400000).toISOString(),
                image: 'https://images.unsplash.com/photo-1533174072545-e8d4aa97d893?q=80&w=1000&auto=format&fit=crop',
                organizer: 'Beach Club Étoile',
                location: 'Grand-Bassam',
                coords: { lat: 5.20, lng: -3.73 },
                distance: '15 km',
                description: 'Les meilleurs DJ de la capitale mixent les hits Coupé-Décalé et Afrobeat les pieds dans le sable !',
                participantCount: 128
            },
            {
                id: '3',
                type: 'image',
                title: 'Match CAN sur écran géant',
                date: new Date(today.getTime() + 172800000).toISOString(),
                image: 'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=1000&auto=format&fit=crop',
                organizer: 'Fan Zone 225',
                location: 'Marcory, Abidjan',
                coords: { lat: 5.305, lng: -3.97 },
                distance: '3.5 km',
                description: 'Venez supporter les Éléphants ! Ambiance de feu garantie, maillots oranges exigés.',
                participantCount: 350
            }
        ]
        this.events.value = initialEvents
    }
}

export const db = new MockDB()
