import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useEventStore = defineStore('events', () => {
    // Mock Data for MVP
    const events = ref([
        {
            id: '3',
            type: 'video',
            title: 'Ambiance Ndombolo 🔥',
            date: new Date().toISOString(),
            image: 'https://images.unsplash.com/photo-1514525253440-b393452e8d26?q=80&w=1000', // Thumbnail
            video: 'https://videos.pexels.com/video-files/3196056/3196056-hd_1080_1920_25fps.mp4', // Vertical dancing video
            organizer: 'Club Carré',
            location: 'Gombe, Kinshasa',
            distance: '1.2 km',
        },
        {
            id: '1',
            type: 'image',
            title: 'Soirée Rumba chez Tonton Jules',
            date: new Date().toISOString(),
            image: 'https://images.unsplash.com/photo-1542396601-dca920ea2807?q=80&w=1000&auto=format&fit=crop', // Beer image
            organizer: 'Tonton Jules',
            location: 'Matonge, Kinshasa',
            distance: '0.5 km',
            audio: null
        },
        {
            id: '2',
            type: 'image',
            title: 'Concert Fally Ipupa (Fan Club)',
            date: new Date(Date.now() + 86400000).toISOString(),
            image: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=1000&auto=format&fit=crop', // Concert
            organizer: 'Stade Martyrs',
            location: 'Lingwala',
            distance: '4.2 km',
            audio: null
        }
    ])

    const addEvent = (event) => {
        // Simulating backend ID generation
        event.id = Math.random().toString(36).substr(2, 9)
        event.date = new Date().toISOString() // Now
        // Add to top of feed
        events.value.unshift(event)
    }

    return { events, addEvent }
})
