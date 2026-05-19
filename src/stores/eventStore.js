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
        if (/\bdj\b|\bclub\b|\b[eé]lectro\b|\btechno\b|\bhouse music\b/.test(text)) return 'dj'
        if (/\bfestival\b/.test(text)) return 'festival'
        if (/\bsport\b|\bfoot(ball)?\b|\bbasket\b|\bmatch\b|\btournoi\b|\bcomp[eé]tition\b/.test(text)) return 'sport'
        if (/\bart\b|\bexpo(sition)?\b|\bculture\b|\bgalerie\b|\bth[eé][aâ]tre\b|\bvernissage\b/.test(text)) return 'art'
        if (/\bcom[eé]die\b|\bhumour\b|\bstand[\s-]?up\b|\bkaraoké?\b/.test(text)) return 'comedie'
        if (/\bafterwork\b|\bafter work\b/.test(text)) return 'afterwork'
        if (/\bconcert\b|\blive\b|\bzouglou\b|\brap\b|\bgospel\b|\bafrobeat\b|\bmusique\b|\bcoup[eé][\s-]d[eé]cal[eé]\b|\breggae\b|\bjazz\b|\br[n&]b\b/.test(text)) return 'musique'
        if (/\bsoir[eé]e\b|\bparty\b|\bnuit\b|\bbo[iî]te\b|\bnightlife\b|\bgala\b/.test(text)) return 'soiree'
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

    // Déduplication par id (évite les doublons si re-seed ou double fetch)
    const dedup = (list) => {
        const seen = new Set()
        return list.filter(e => {
            if (seen.has(e.id)) return false
            seen.add(e.id)
            return true
        })
    }

    /**
     * Charger les événements depuis Supabase.
     * Si la table est vide, on seed avec les données locales.
     * Fallback sur les données locales en cas d'erreur réseau.
     */
    const loadEvents = async () => {
        if (isLoading.value) return   // verrou anti-appel concurrent
        isLoading.value = true
        try {
            const supaEvents = await supaFetchEvents()
            
            if (supaEvents.length > 0) {
                events.value = dedup(enrichWithCategories(supaEvents))
            } else {
                // Table vide → seed avec les données locales
                console.log(' Table Supabase vide, insertion des données seed...')
                db.seedEvents()
                const localEvents = db.getEvents()
                const seeded = await supaSeedEvents(localEvents)
                if (seeded.length > 0) {
                    events.value = dedup(enrichWithCategories(seeded))
                    console.log(` ${seeded.length} événements insérés dans Supabase`)
                } else {
                    console.warn('️ Seed Supabase échoué, utilisation des données locales')
                    events.value = dedup(localEvents)
                }
            }
        } catch (error) {
            console.error(' Erreur chargement Supabase, fallback local:', error)
            db.seedEvents()
            events.value = dedup(db.getEvents())
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

