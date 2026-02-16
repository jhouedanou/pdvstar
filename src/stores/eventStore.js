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

export const useEventStore = defineStore('events', () => {
    // Events list (reactive)
    const events = ref([])
    const isLoading = ref(false)
    const isInitialized = ref(false)

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
                events.value = supaEvents
            } else {
                // Table vide → seed avec les données locales
                console.log('📦 Table Supabase vide, insertion des données seed...')
                const localEvents = db.getEvents()
                const seeded = await supaSeedEvents(localEvents)
                if (seeded.length > 0) {
                    events.value = seeded
                    console.log(`✅ ${seeded.length} événements insérés dans Supabase`)
                } else {
                    // Fallback local si le seed échoue
                    console.warn('⚠️ Seed Supabase échoué, utilisation des données locales')
                    events.value = localEvents
                }
            }
        } catch (error) {
            console.error('❌ Erreur chargement Supabase, fallback local:', error)
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
            console.error('❌ Erreur ajout Supabase, fallback local:', error)
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
            console.error('❌ Erreur update Supabase:', error)
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
            console.error('❌ Erreur delete Supabase:', error)
            events.value = previousEvents
        }
    }

    const refreshEvents = async () => {
        await loadEvents()
    }

    return {
        events,
        isLoading,
        isInitialized,
        loadEvents,
        addEvent,
        updateEvent,
        deleteEvent,
        refreshEvents
    }
})

