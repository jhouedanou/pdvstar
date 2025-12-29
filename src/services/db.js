
import { useStorage } from '@vueuse/core'

class MockDB {
    constructor() {
        // Persistent storage using VueUse (wraps localStorage)
        this.users = useStorage('pdvstar_db_users', [])
        this.events = useStorage('pdvstar_db_events', [])

        // Initialize with seed data if empty or invalid
        if (this.events.value.length === 0 || !this.events.value[0].coords || !this.events.value[0].image) {
            this.seedEvents()
        }
    }

    // --- HELPERS ---
    getPlaceholderImage(indexOrRandom) {
        const placeholders = [
            'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?q=80&w=800', // Nightclub with lights
            'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=800', // Concert crowd
            'https://images.unsplash.com/photo-1514525253440-b393452e8d26?q=80&w=800', // DJ performing
            'https://images.unsplash.com/photo-1574391884720-2e40d0246a48?q=80&w=800', // Cocktail drinks
            'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800', // Live music concert
            'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800', // Nightclub interior
            'https://images.unsplash.com/photo-1571266028243-d220c6e2e9cf?q=80&w=800', // DJ booth neon
            'https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?q=80&w=800', // Club dance floor
            'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=800', // Party confetti
            'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800', // Stage concert
            'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800', // Rooftop party
            'https://images.unsplash.com/photo-1533174072545-e8d4aa97d893?q=80&w=800', // Beach party sunset
            'https://images.unsplash.com/photo-1505236858219-8359eb29e329?q=80&w=800', // Bar atmosphere
            'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=800', // Festival crowd
            'https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=800', // Lounge setting
            'https://images.unsplash.com/photo-1598387181032-a3103a2db5b3?q=80&w=800', // DJ mixer close-up
            'https://images.unsplash.com/photo-1547620916-c41e3b5c4a5f?q=80&w=800', // Party lights purple
            'https://images.unsplash.com/photo-1571266028243-d220c6e2e9cf?q=80&w=800', // Neon club lights
            'https://images.unsplash.com/photo-1509824227185-9c5a01ceba0d?q=80&w=800', // Urban nightlife
            'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?q=80&w=800'  // City nightlife skyline
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
        // Realistic Abidjan Data
        const organizers = ['Babi Event', 'Life Magazine', 'Pulse CI', 'Vibe Radio', 'Abidjan.net', 'Club 225', 'Yopougon Enjaillement']
        const zones = [
            { name: 'Marcory Zone 4', lat: 5.297, lng: -3.974 },
            { name: 'Cocody Vallons', lat: 5.352, lng: -3.998 },
            { name: 'Plateau', lat: 5.324, lng: -4.020 },
            { name: 'Yopougon Niangon', lat: 5.341, lng: -4.076 },
            { name: 'Biétry', lat: 5.286, lng: -3.982 },
            { name: 'Mille Maquis', lat: 5.309, lng: -3.950 },
            { name: 'Riviera Golf', lat: 5.334, lng: -3.970 },
            { name: 'Treichville', lat: 5.299, lng: -4.009 }
        ]

        const templates = [
            { title: "Soirée Coupé Décalé", desc: "Les meilleurs sons d'Abidjan pour danser jusqu'au matin !" },
            { title: "Afterwork Chill", desc: "Détente après le boulot avec cocktails et tapas." },
            { title: "Concert Live Zouglou", desc: "Wôyo authentique, ambiance garantie." },
            { title: "Brunch du Dimanche", desc: "Buffet à volonté et piscine pour bien finir la semaine." },
            { title: "Showcase Rap Ivoire", desc: "Les nouvelles pépites du rap ivoirien en live." },
            { title: "Karaoké Night", desc: "Venez chanter vos titres préférés entre amis." },
            { title: "Soirée Retro", desc: "Les classiques des années 90 et 2000." },
            { title: "Festival Grillades", desc: "Choukouya, poisson braisé et poulet piqué." }
        ]

        const events = []
        const today = new Date()

        for (let i = 0; i < 20; i++) {
            const zone = zones[i % zones.length]
            const tmpl = templates[i % templates.length]
            // Random offset for location to avoid perfect overlap
            const lat = zone.lat + (Math.random() * 0.01 - 0.005)
            const lng = zone.lng + (Math.random() * 0.01 - 0.005)

            // Random date (Upcoming 2 weeks)
            const daysOffset = Math.floor(Math.random() * 14)
            const date = new Date(today.getTime() + (daysOffset * 86400000))
            // Random evenish hour
            date.setHours(18 + Math.floor(Math.random() * 6), 0)

            // Determine if event is premium (20% chance)
            const isPremium = Math.random() < 0.2

            events.push({
                id: `evt-${i + 1}`,
                type: 'image',
                title: `${tmpl.title} @ ${zone.name}`,
                date: date.toISOString(),
                organizer: organizers[Math.floor(Math.random() * organizers.length)],
                location: zone.name,
                coords: { lat, lng },
                // Calc fake distance based on Marcory center for initial display
                distance: `${(Math.sqrt(Math.pow(lat - 5.309, 2) + Math.pow(lng + 3.974, 2)) * 111).toFixed(1)} km`,
                description: tmpl.desc,
                image: this.getPlaceholderImage(i),
                participantCount: Math.floor(Math.random() * 500) + 20,
                isRegistered: false,
                isPremium: isPremium,
                price: isPremium ? Math.floor(Math.random() * 15000) + 5000 : 0, // 5000-20000 CFA for premium
                features: isPremium ? ['VIP Access', 'Free Drink', 'Photo Booth'] : []
            })
        }

        this.events.value = events
    }

    // --- ADS ---
    getAds() {
        return [
            {
                id: 'ad-1',
                type: 'banner',
                title: 'Orange Money',
                description: 'Paiements instantanés pour vos events !',
                image: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=800',
                link: '#',
                sponsor: 'Orange CI'
            },
            {
                id: 'ad-2',
                type: 'banner',
                title: 'Heineken',
                description: 'La bière officielle des nuits Abidjan',
                image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?q=80&w=800',
                link: '#',
                sponsor: 'Heineken'
            },
            {
                id: 'ad-3',
                type: 'banner',
                title: 'Uber Eats',
                description: 'Livraison 24/7 après la fête',
                image: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?q=80&w=800',
                link: '#',
                sponsor: 'Uber Eats'
            }
        ]
    }
}

export const db = new MockDB()
