import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../services/db'

export const useUserStore = defineStore('user', () => {
    // Load current session from localStorage (pointer to logged in user)
    const loadSession = () => {
        const stored = localStorage.getItem('pdvstar_session_user')
        return stored ? JSON.parse(stored) : null
    }

    const user = ref(loadSession())

    const isProfileComplete = computed(() => {
        return user.value && user.value.name && user.value.phone
    })

    // This now acts as Login OR Register
    const authenticate = (profileData) => {
        let existingUser = db.findUserByPhone(profileData.phone)

        if (existingUser) {
            // Login
            user.value = existingUser
        } else {
            // Register
            user.value = db.createUser({
                name: profileData.name || `Utilisateur ${profileData.phone}`,
                phone: profileData.phone,
                email: profileData.email || '',
                role: 'user'
            })
        }

        // Save session
        localStorage.setItem('pdvstar_session_user', JSON.stringify(user.value))
        return user.value
    }

    const updateProfile = (updates) => {
        if (user.value) {
            const updated = db.updateUser(user.value.id, updates)
            if (updated) {
                user.value = updated
                localStorage.setItem('pdvstar_session_user', JSON.stringify(updated))
            }
        }
    }

    const logout = () => {
        user.value = null
        localStorage.removeItem('pdvstar_session_user')
    }

    return {
        user,
        isProfileComplete,
        authenticate,
        updateProfile,
        logout
    }
})
