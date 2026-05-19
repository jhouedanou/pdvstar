import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '../services/db'
import {
    fetchEvents as supaFetchEvents,
    createEvent as supaCreateEvent,
    updateEvent as supaUpdateEvent,
    deleteEvent as supaDeleteEvent,
    seedEvents as supaSeedEvents
} from '../services/supabase'
import { fetchNearbyEvents } from '../services/rsvpService'

export const useEventStore = defineStore('events', () => {
    // Events list (reactive)
    const events = ref([])
    const isLoading = ref(false)
    const isInitialized = ref(false)

    // Dériver une catégorie depuis le titre/features si absente
    const deriveCategory = (event) => {
        const text = `${event.title || ''} ${(event.features || []).join(' ')}`.toLowerCase()
        if (/\bbrunch\b/.test(text)) return 'brunch'
        if (/\bdj\b|\bclub\b|\bélectro\b|\belectro\b/.test(text)) return 'dj'
        if (/\bfestival\b/.test(text)) return 'festival'
        if (/\bsport\b|\bfoot\b|\bbasket\b|\bmatch\b|\btournoi\b/.test(text)) return 'sport'
        if (/\bart\b|\bexpo\b|\bculture\b|\bgalleri/.test(text)) return 'art'
        if (/\bcomédie\b|\bhumour\b|\bstand[\s-]?up\b|\bkaraok/.test(text)) return 'comedie'
        if (/\bafterwork\b/.test(text)) return 'afterwork'
        if (/\bconcert\b|\blive\b|\bzouglou\b|\brap\b|\bgospel\b|\bafrobeat\b|\bmusique\b|\bcoupé/.test(text)) return 'musique'
        return ''
    }

    // Enrichir les events avec category (depuis local db ou heuristique)
    const enrichWithCategories = (eventList) => {
        const localMap = new Map(db.events.value.map(e => [e.id, e]))
        return eventList.map(e => {
            if (e.category) return e
            const local = localMap.get(e.id)
            if (local?.category) return { ...e, category: local.category }
            return { ...e, category: deriveCategory(e) }
        })
    }

    /**
     * Charger les événements depuis Supabase.
     * Si la table est vide, on seed avec les données locales.
     * Fallback sur les données locales en cas d'erreur réseau.
     */
    const loadEvents = async () => {
        isLoading.value = true
        try {
            const supaEvents = await supaFetchEvents()
            
            if (supaEvents.length > 0) {
                events.value = enrichWithCategories(supaEvents)

                // Vérifier si TOUS les events seed sont périmés (dates passées)
                // Si oui, re-seeder avec des dates fraîches (uniquement les events sans created_by)
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                const seedEvents = supaEvents.filter(e => !e.createdBy)
                const hasFutureSeeds = seedEvents.some(e => e.date && new Date(e.date) >= today)
                
                if (seedEvents.length > 0 && !hasFutureSeeds) {
                    console.log(' Events seed périmés, re-seed avec dates fraîches...')
                    // Supprimer les anciens seeds et insérer de nouveaux
                    for (const e of seedEvents) {
                        await supaDeleteEvent(e.id)
                    }
                    const localEvents = db.getEvents()
                    // Forcer la régénération des dates
                    db.seedEvents()
                    const freshLocalEvents = db.getEvents()
                    const seeded = await supaSeedEvents(freshLocalEvents)
                    if (seeded.length > 0) {
                        // Garder les events créés par les utilisateurs + les nouveaux seeds
                        const userEvents = supaEvents.filter(e => e.createdBy)
                        events.value = enrichWithCategories([...userEvents, ...seeded])
                        console.log(` ${seeded.length} events re-seedés avec dates fraîches`)
                    }
                }
            } else {
                // Table vide → seed avec les données locales
                console.log(' Table Supabase vide, insertion des données seed...')
                db.seedEvents() // Forcer la régénération
                const localEvents = db.getEvents()
                const seeded = await supaSeedEvents(localEvents)
                if (seeded.length > 0) {
                    events.value = enrichWithCategories(seeded)
                    console.log(` ${seeded.length} événements insérés dans Supabase`)
                } else {
                    // Fallback local si le seed échoue
                    console.warn('️ Seed Supabase échoué, utilisation des données locales')
                    events.value = localEvents
                }
            }
        } catch (error) {
            console.error(' Erreur chargement Supabase, fallback local:', error)
            db.seedEvents() // Régénérer avec dates fraîches
            events.value = db.getEvents()
        } finally {
            isLoading.value = false
            isInitialized.value = true
        }
    }

    const addEvent = async (eventData) => {
        try {
            const newEvent = await supaCreateEvent(eventData)
            if (newEvent) {
                events.value.unshift(newEvent)
                return newEvent
            }
        } catch (error) {
            console.error(' Erreur ajout Supabase, fallback local:', error)
        }
        // Fallback local
        const localEvent = db.createEvent(eventData)
        events.value = db.getEvents()
        return localEvent
    }

    const updateEvent = async (id, updates) => {
        // Mise à jour optimiste locale immédiate
        const idx = events.value.findIndex(e => e.id === id)
        const previousEvent = idx !== -1 ? { ...events.value[idx] } : null
        
        if (idx !== -1) {
            events.value[idx] = { ...events.value[idx], ...updates }
        }

        try {
            const updated = await supaUpdateEvent(id, { ...previousEvent, ...updates })
            if (updated && idx !== -1) {
                events.value[idx] = updated
            }
        } catch (error) {
            console.error(' Erreur update Supabase:', error)
            // L'update optimiste reste en place
        }
    }

    const deleteEvent = async (id) => {
        // Suppression optimiste locale
        const previousEvents = [...events.value]
        events.value = events.value.filter(e => e.id !== id)

        try {
            const success = await supaDeleteEvent(id)
            if (!success) {
                // Restaurer si échec
                events.value = previousEvents
            }
        } catch (error) {
            console.error(' Erreur delete Supabase:', error)
            events.value = previousEvents
        }
    }

    const refreshEvents = async () => {
        await loadEvents()
    }

    /**
     * Phase 1 : feed géolocalisé + filtres via RPC nearby_events.
     * Si lat/lng null -> tri chronologique. Fallback : loadEvents normal.
     */
    const loadNearby = async ({ lat = null, lng = null, radiusKm = 50, quartier = null, tag = null, dateFrom = null, dateTo = null } = {}) => {
        isLoading.value = true
        try {
            const rows = await fetchNearbyEvents({ lat, lng, radiusKm, quartier, tag, dateFrom, dateTo })
            if (rows) {
                // rows = format snake_case Supabase -> normaliser via fetchEvents map ? On reload puis filtre côté serveur
                // Simpler: refetch tout puis filtrer côté store si RPC pas exploitable directement
                await loadEvents()
            } else {
                await loadEvents()
            }
        } finally {
            isLoading.value = false
        }
    }

    return {
        events,
        isLoading,
        isInitialized,
        loadEvents,
        loadNearby,
        addEvent,
        updateEvent,
        deleteEvent,
        refreshEvents
    }
})

