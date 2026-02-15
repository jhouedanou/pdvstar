import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAdminStore = defineStore('admin', () => {
    // Admin credentials (hardcoded as per requirement)
    const ADMIN_USERNAME = 'admin'
    const ADMIN_PASSWORD = 'admin'

    // Load session from localStorage
    const loadSession = () => {
        const stored = localStorage.getItem('pdvstar_admin_session')
        if (stored) {
            const session = JSON.parse(stored)
            // Check expiry (24 hours for admin)
            if (session.expiry && Date.now() > session.expiry) {
                localStorage.removeItem('pdvstar_admin_session')
                return null
            }
            return session.isAuthenticated ? true : null
        }
        return null
    }

    const isAuthenticated = ref(loadSession() || false)
    const loginError = ref('')

    const login = (username, password) => {
        loginError.value = ''
        
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            isAuthenticated.value = true
            const session = {
                isAuthenticated: true,
                expiry: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            }
            localStorage.setItem('pdvstar_admin_session', JSON.stringify(session))
            return true
        } else {
            loginError.value = 'Identifiants incorrects'
            return false
        }
    }

    const logout = () => {
        isAuthenticated.value = false
        localStorage.removeItem('pdvstar_admin_session')
    }

    return {
        isAuthenticated,
        loginError,
        login,
        logout
    }
})
