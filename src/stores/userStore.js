import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../services/db'

export const useUserStore = defineStore('user', () => {
    // Load current session from localStorage (pointer to logged in user)
    const loadSession = () => {
        const stored = localStorage.getItem('pdvstar_session_user')
        if (stored) {
            const session = JSON.parse(stored)
            // Check expiry (7 Days)
            if (session.expiry && Date.now() > session.expiry) {
                localStorage.removeItem('pdvstar_session_user')
                return null
            }
            return session.user
        }
        return null
    }

    const user = ref(loadSession())

    const isProfileComplete = computed(() => {
        return user.value && user.value.name && user.value.phone
    })

    // This now acts as Login OR Register
    const authenticate = (profileData) => {
        let existingUser = db.findUserByPhone(profileData.phone)

        let currentUser;
        if (existingUser) {
            // Login
            currentUser = existingUser
        } else {
            // Register
            currentUser = db.createUser({
                name: profileData.name || `Utilisateur ${profileData.phone}`,
                phone: profileData.phone,
                email: profileData.email || '',
                role: 'user'
            })
        }

        user.value = currentUser

        // Save session with Expiry (7 Days)
        const session = {
            user: user.value,
            expiry: Date.now() + (7 * 24 * 60 * 60 * 1000) // 1 Week
        }
        localStorage.setItem('pdvstar_session_user', JSON.stringify(session))
        return user.value
    }

    const updateProfile = (updates) => {
        if (user.value) {
            const updated = db.updateUser(user.value.id, updates)
            if (updated) {
                user.value = updated
                // Update session keeping expiry
                const stored = localStorage.getItem('pdvstar_session_user')
                const currentSession = stored ? JSON.parse(stored) : { expiry: Date.now() + (7 * 24 * 60 * 60 * 1000) }

                const newSession = {
                    ...currentSession,
                    user: updated
                }
                localStorage.setItem('pdvstar_session_user', JSON.stringify(newSession))
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
