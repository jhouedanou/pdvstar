import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUserStore = defineStore('user', () => {
    // Load from localStorage or initialize
    const loadUserFromStorage = () => {
        const stored = localStorage.getItem('pdvstar_user')
        return stored ? JSON.parse(stored) : null
    }

    const user = ref(loadUserFromStorage())
    
    const isProfileComplete = computed(() => {
        return user.value && user.value.name && user.value.phone
    })

    const createProfile = (profileData) => {
        user.value = {
            id: Math.random().toString(36).substr(2, 9),
            name: profileData.name,
            phone: profileData.phone || '+22545029721',
            email: profileData.email || '',
            createdAt: new Date().toISOString()
        }
        // Save to localStorage
        localStorage.setItem('pdvstar_user', JSON.stringify(user.value))
        return user.value
    }

    const updateProfile = (updates) => {
        if (user.value) {
            user.value = {
                ...user.value,
                ...updates
            }
            localStorage.setItem('pdvstar_user', JSON.stringify(user.value))
        }
    }

    const clearProfile = () => {
        user.value = null
        localStorage.removeItem('pdvstar_user')
    }

    return {
        user,
        isProfileComplete,
        createProfile,
        updateProfile,
        clearProfile
    }
})
