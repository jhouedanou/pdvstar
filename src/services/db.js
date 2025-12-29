
import { useStorage } from '@vueuse/core'

class MockDB {
    constructor() {
        // Persistent storage using VueUse (wraps localStorage)
        this.users = useStorage('pdvstar_db_users', [])
        this.events = useStorage('pdvstar_db_events', [])

        // Initialize with seed data if empty
        if (this.events.value.length === 0) {
            this.seedEvents()
        }
    }

    // --- HELPERS ---
    getPlaceholderImage(indexOrRandom) {
        const placeholders = [
            'https://images.unsplash.com/photo-1542396601-dca920ea2807?q=80&w=600', // Bar
            'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600', // Club
            'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600', // Concert
            'https://images.unsplash.com/photo-1533174072545-e8d4aa97d893?q=80&w=600', // Beach Party
            'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=600', // Crowd
            'https://images.unsplash.com/photo-1514525253440-b393452e8d26?q=80&w=600', // DJ
            'https://images.unsplash.com/photo-1574391884720-2e40d0246a48?q=80&w=600'  // Drink
        ]
        const idx = typeof indexOrRandom === 'number'
            ? indexOrRandom
            : Math.floor(Math.random() * placeholders.length)
        return placeholders[idx % placeholders.length]
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
        return [...this.events.value].sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date))
    }

    createEvent(eventData) {
        // Ensure image is present, if not use placeholder
        const image = eventData.image || this.getPlaceholderImage()

        const newEvent = {
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
            participantCount: 0,
            isRegistered: false,
            ...eventData,
            image: image
        }
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
        // Re-seed with reliable images
        const today = new Date()
        const initialEvents = [
            {
                id: '1',
                type: 'image',
                title: 'Soirée Concert Rumba chez Tonton Jules',
                date: new Date().toISOString(),
                image: this.getPlaceholderImage(2),
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
                image: this.getPlaceholderImage(3),
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
                image: this.getPlaceholderImage(4),
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
