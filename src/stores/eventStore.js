import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '../services/db'

export const useEventStore = defineStore('events', () => {
    // Load events from DB
    const events = ref(db.getEvents())

    const addEvent = (eventData) => {
        const newEvent = db.createEvent(eventData)
        // Refresh local list
        events.value = db.getEvents()
        return newEvent
    }

    const updateEvent = (id, updates) => {
        const updated = db.updateEvent(id, updates)
        if (updated) {
            // Update local state in place to avoid full refresh if possible, or just refresh
            const idx = events.value.findIndex(e => e.id === id)
            if (idx !== -1) {
                events.value[idx] = updated
            }
        }
    }

    const refreshEvents = () => {
        events.value = db.getEvents()
    }

    return {
        events,
        addEvent,
        updateEvent,
        refreshEvents
    }
})
