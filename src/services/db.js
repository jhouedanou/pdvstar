
import { useStorage } from '@vueuse/core'

class MockDB {
    constructor() {
        // Persistent storage using VueUse (wraps localStorage)
        this.users = useStorage('pdvstar_db_users', [])
        this.events = useStorage('pdvstar_db_events', [])

        // Initialize with seed data if empty or invalid or missing coords/category
        const needsReset = this.events.value.length === 0 || 
                          !this.events.value[0]?.coords || 
                          !this.events.value[0]?.image ||
                          this.events.value.filter(e => e.coords).length < 15 ||
                          !this.events.value[0]?.category // Reset if category field is missing
        
        if (needsReset) {
            console.log(' Reinitializing events with coordinates and categories...')
            this.seedEvents()
        }
    }

    // --- HELPERS ---
    getPlaceholderImage(indexOrRandom) {
        const placeholders = [
            'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80', // Nightclub interior
            'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&auto=format&fit=crop&q=80', // Concert crowd
            'https://images.unsplash.com/photo-1514525253440-b393452e8d26?w=800&auto=format&fit=crop&q=80', // DJ performing
            'https://images.unsplash.com/photo-1574391884720-2e40d0246a48?w=800&auto=format&fit=crop&q=80', // Cocktail drinks
            'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=800&auto=format&fit=crop&q=80', // Party confetti
            'https://images.unsplash.com/photo-1533174072545-e8d4aa97d893?w=800&auto=format&fit=crop&q=80', // Beach party sunset
            'https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=800&auto=format&fit=crop&q=80', // Bar atmosphere
            'https://images.unsplash.com/photo-1506157786151-b8491531f063?w=800&auto=format&fit=crop&q=80', // Lounge setting
            'https://images.unsplash.com/photo-1598387181032-a3103a2db5b3?w=800&auto=format&fit=crop&q=80', // DJ mixer close-up
            'https://images.unsplash.com/photo-1547620916-c41e3b5c4a5f?w=800&auto=format&fit=crop&q=80', // Party lights purple
            'https://images.unsplash.com/photo-1509824227185-9c5a01ceba0d?w=800&auto=format&fit=crop&q=80', // Urban nightlife
            'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=800&auto=format&fit=crop&q=80', // City nightlife skyline
            'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&auto=format&fit=crop&q=80', // Concert lights
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop&q=80', // Sports stadium
            'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&auto=format&fit=crop&q=80', // Stadium night
            'https://images.unsplash.com/photo-1504450874802-0ba2bcd9b5ae?w=800&auto=format&fit=crop&q=80', // Night bar
            'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80', // Live music concert
            'https://images.unsplash.com/photo-1514306191717-452ec28c7814?w=800&auto=format&fit=crop&q=80', // Dance floor
            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80', // Music concert
            'https://images.unsplash.com/photo-1563841930606-67e2bce48b78?w=800&auto=format&fit=crop&q=80'  // Neon lights party
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
        const today = new Date()
        const d = (offsetDays, hour = 20, min = 0) => {
            const dt = new Date(today)
            dt.setDate(dt.getDate() + offsetDays)
            dt.setHours(hour, min, 0, 0)
            return dt.toISOString()
        }

        const events = [
            {
                id: 'evt-1', status: 'approved', category: 'musique',
                title: "Soirée Coupé Décalé @ Marcory Zone 4",
                date: d(1, 21), organizer: 'Babi Event', location: 'Marcory Zone 4',
                coords: { lat: 5.297, lng: -3.974 }, distance: '1.2 km',
                description: "Les meilleurs sons d'Abidjan pour danser jusqu'au matin ! Coupé décalé, zouglou, afrobeats.",
                image: this.getPlaceholderImage(0), participantCount: 312, isPremium: false, price: 0,
                features: ['Zouglou', 'Coupé Décalé', 'Bar']
            },
            {
                id: 'evt-2', status: 'approved', category: 'afterwork',
                title: "Afterwork Chill @ Cocody Vallons",
                date: d(1, 18, 30), organizer: 'Life Magazine', location: 'Cocody Vallons',
                coords: { lat: 5.352, lng: -3.998 }, distance: '4.7 km',
                description: "Détente après le boulot avec cocktails et tapas. DJ set ambiance lounge.",
                image: this.getPlaceholderImage(1), participantCount: 160, isPremium: false, price: 0,
                features: ['Cocktails', 'Tapas', 'Afterwork']
            },
            {
                id: 'evt-3', status: 'approved', category: 'musique',
                title: "Concert Live Zouglou @ Yopougon Niangon",
                date: d(3, 20), organizer: 'Pulse CI', location: 'Yopougon Niangon',
                coords: { lat: 5.341, lng: -4.076 }, distance: '8.3 km',
                description: "Wôyo authentique, ambiance garantie. Les meilleures voix de Côte d'Ivoire sur scène.",
                image: this.getPlaceholderImage(2), participantCount: 480, isPremium: false, price: 0,
                features: ['Zouglou', 'Concert', 'Live']
            },
            {
                id: 'evt-4', status: 'approved', category: 'brunch',
                title: "Brunch du Dimanche @ Riviera Golf",
                date: d(4, 11), organizer: 'Club 225', location: 'Riviera Golf',
                coords: { lat: 5.334, lng: -3.970 }, distance: '3.5 km',
                description: "Buffet à volonté, piscine et musique live. Le meilleur brunch d'Abidjan.",
                image: this.getPlaceholderImage(3), participantCount: 95, isPremium: true, price: 15000,
                features: ['Buffet', 'Piscine', 'Brunch', 'VIP Access']
            },
            {
                id: 'evt-5', status: 'approved', category: 'musique',
                title: "Showcase Rap Ivoire @ Plateau",
                date: d(5, 20, 30), organizer: 'Vibe Radio', location: 'Plateau',
                coords: { lat: 5.324, lng: -4.020 }, distance: '2.1 km',
                description: "Les nouvelles pépites du rap ivoirien en live. Freestyle, beatbox et surprises.",
                image: this.getPlaceholderImage(4), participantCount: 220, isPremium: false, price: 2000,
                features: ['Rap', 'Live', 'Concert'], ticketingEnabled: true, ticketPrice: 2000
            },
            {
                id: 'evt-6', status: 'approved', category: 'dj',
                title: "DJ Night @ Club Marcory",
                date: d(2, 22), organizer: 'Abidjan.net', location: 'Marcory Zone 4',
                coords: { lat: 5.298, lng: -3.975 }, distance: '1.3 km',
                description: "La nuit des DJs les plus chauds d'Abidjan. Entrée VIP disponible.",
                image: this.getPlaceholderImage(5), participantCount: 350, isPremium: true, price: 10000,
                features: ['DJ', 'Club', 'VIP Access', 'Free Drink'], ticketingEnabled: true, ticketPrice: 10000
            },
            {
                id: 'evt-7', status: 'approved', category: 'festival',
                title: "Festival Grillades @ Treichville",
                date: d(6, 17), organizer: 'Babi Event', location: 'Treichville',
                coords: { lat: 5.299, lng: -4.009 }, distance: '2.8 km',
                description: "Choukouya, poisson braisé et poulet piqué. Ambiance village authentique.",
                image: this.getPlaceholderImage(6), participantCount: 491, isPremium: false, price: 0,
                features: ['Festival', 'Grillades', 'Gastronomie']
            },
            {
                id: 'evt-8', status: 'approved', category: 'sport',
                title: "Match de Foot @ Stade Biétry",
                date: d(4, 16), organizer: 'Pulse CI', location: 'Biétry',
                coords: { lat: 5.286, lng: -3.982 }, distance: '2.4 km',
                description: "Le derby d'Abidjan ! Atmosphere de feu garantie au stade.",
                image: this.getPlaceholderImage(7), participantCount: 1200, isPremium: false, price: 1000,
                features: ['Football', 'Sport', 'Derby'], ticketingEnabled: true, ticketPrice: 1000
            },
            {
                id: 'evt-9', status: 'approved', category: 'art',
                title: "Expo Art Contemporain @ Plateau",
                date: d(7, 10), organizer: 'Club 225', location: 'Plateau',
                coords: { lat: 5.325, lng: -4.021 }, distance: '2.0 km',
                description: "Œuvres d'artistes ivoiriens émergents. Vernissage avec cocktail.",
                image: this.getPlaceholderImage(8), participantCount: 65, isPremium: false, price: 0,
                features: ['Art', 'Expo', 'Culture']
            },
            {
                id: 'evt-10', status: 'approved', category: 'comedie',
                title: "Stand-up Comedy Night @ Zone 4",
                date: d(5, 20), organizer: 'Yopougon Enjaillement', location: 'Marcory Zone 4',
                coords: { lat: 5.296, lng: -3.973 }, distance: '1.1 km',
                description: "Les meilleurs humoristes ivoiriens sur scène. Rires garantis !",
                image: this.getPlaceholderImage(9), participantCount: 180, isPremium: false, price: 3000,
                features: ['Comédie', 'Humour', 'Stand-up'], ticketingEnabled: true, ticketPrice: 3000
            },
            {
                id: 'evt-11', status: 'approved', category: 'dj',
                title: "Nuit Électro @ Cocody",
                date: d(8, 23), organizer: 'Life Magazine', location: 'Cocody Vallons',
                coords: { lat: 5.353, lng: -3.999 }, distance: '4.8 km',
                description: "Soirée electro, house et techno avec les meilleurs DJs d'Abidjan.",
                image: this.getPlaceholderImage(10), participantCount: 290, isPremium: true, price: 8000,
                features: ['DJ', 'Electro', 'Club'], ticketingEnabled: true, ticketPrice: 8000
            },
            {
                id: 'evt-12', status: 'approved', category: 'brunch',
                title: "Brunch Piscine @ Riviera Palmeraie",
                date: d(10, 10, 30), organizer: 'Club 225', location: 'Riviera Golf',
                coords: { lat: 5.333, lng: -3.968 }, distance: '3.2 km',
                description: "Brunch buffet avec accès piscine. Musique chill et ambiance tropicale.",
                image: this.getPlaceholderImage(11), participantCount: 120, isPremium: false, price: 12000,
                features: ['Brunch', 'Piscine', 'Buffet'], ticketingEnabled: true, ticketPrice: 12000
            },
            {
                id: 'evt-13', status: 'approved', category: 'musique',
                title: "Concert Gospel @ Yopougon",
                date: d(9, 17), organizer: 'Vibe Radio', location: 'Yopougon Niangon',
                coords: { lat: 5.342, lng: -4.077 }, distance: '8.5 km',
                description: "Grande soirée gospel avec les meilleures chorales d'Abidjan. Entrée libre.",
                image: this.getPlaceholderImage(12), participantCount: 750, isPremium: false, price: 0,
                features: ['Gospel', 'Concert', 'Chorale']
            },
            {
                id: 'evt-14', status: 'approved', category: 'afterwork',
                title: "Afterwork Jazz @ Café du Plateau",
                date: d(11, 18), organizer: 'Abidjan.net', location: 'Plateau',
                coords: { lat: 5.323, lng: -4.019 }, distance: '1.9 km',
                description: "Sessions jazz live avec des musiciens locaux et internationaux.",
                image: this.getPlaceholderImage(13), participantCount: 85, isPremium: false, price: 5000,
                features: ['Jazz', 'Afterwork', 'Live'], ticketingEnabled: true, ticketPrice: 5000
            },
            {
                id: 'evt-15', status: 'approved', category: 'festival',
                title: "Festival Urbain Abidjan @ Treichville",
                date: d(14, 16), organizer: 'Pulse CI', location: 'Treichville',
                coords: { lat: 5.300, lng: -4.010 }, distance: '2.9 km',
                description: "3 jours de festival : musique, danse, gastronomie et artisanat.",
                image: this.getPlaceholderImage(14), participantCount: 2500, isPremium: false, price: 0,
                features: ['Festival', 'Musique', 'Gastronomie']
            },
            {
                id: 'evt-16', status: 'approved', category: 'sport',
                title: "Tournoi Basketball @ Marcory",
                date: d(12, 15), organizer: 'Babi Event', location: 'Mille Maquis',
                coords: { lat: 5.309, lng: -3.951 }, distance: '0.4 km',
                description: "Tournoi inter-quartiers de basket. Venez soutenir votre équipe !",
                image: this.getPlaceholderImage(15), participantCount: 340, isPremium: false, price: 0,
                features: ['Basketball', 'Sport', 'Tournoi']
            },
            {
                id: 'evt-17', status: 'approved', category: 'art',
                title: "Art Street Show @ Zone 4",
                date: d(13, 17, 30), organizer: 'Club 225', location: 'Marcory Zone 4',
                coords: { lat: 5.297, lng: -3.972 }, distance: '1.0 km',
                description: "Graffiti, danse urbaine et musique dans les rues. Événement gratuit et ouvert à tous.",
                image: this.getPlaceholderImage(16), participantCount: 200, isPremium: false, price: 0,
                features: ['Art', 'Graffiti', 'Urbain']
            },
            {
                id: 'evt-18', status: 'approved', category: 'comedie',
                title: "Karaoké & Rires @ Biétry",
                date: d(15, 20), organizer: 'Yopougon Enjaillement', location: 'Biétry',
                coords: { lat: 5.287, lng: -3.983 }, distance: '2.5 km',
                description: "Karaoké géant + sketches comiques. Venez chanter et rire entre amis !",
                image: this.getPlaceholderImage(17), participantCount: 145, isPremium: false, price: 1500,
                features: ['Karaoké', 'Comédie', 'Animation'], ticketingEnabled: true, ticketPrice: 1500
            },
            {
                id: 'evt-19', status: 'approved', category: 'musique',
                title: "Soirée Afrobeats @ Yopougon",
                date: d(17, 21), organizer: 'Vibe Radio', location: 'Yopougon Niangon',
                coords: { lat: 5.340, lng: -4.075 }, distance: '8.1 km',
                description: "Les hits afrobeats et dancehall de l'année. DJ international invité.",
                image: this.getPlaceholderImage(18), participantCount: 420, isPremium: true, price: 7000,
                features: ['Afrobeats', 'Dancehall', 'DJ'], ticketingEnabled: true, ticketPrice: 7000
            },
            {
                id: 'evt-20', status: 'approved', category: 'afterwork',
                title: "Afterwork Beach @ Grand-Bassam",
                date: d(20, 17), organizer: 'Life Magazine', location: 'Grand-Bassam',
                coords: { lat: 5.200, lng: -3.735 }, distance: '30 km',
                description: "Excursion afterwork sur la plage de Grand-Bassam. Transport organisé depuis Abidjan.",
                image: this.getPlaceholderImage(19), participantCount: 75, isPremium: false, price: 5000,
                features: ['Beach', 'Afterwork', 'Excursion'], ticketingEnabled: true, ticketPrice: 5000
            }
        ]

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
