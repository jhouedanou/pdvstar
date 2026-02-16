import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db } from '../services/db'
import {
    findUserByPhone as supaFindUserByPhone,
    createUser as supaCreateUser,
    updateUser as supaUpdateUser,
    getActivePass as supaGetActivePass,
    purchasePass as supaPurchasePass,
    getUserPasses as supaGetUserPasses,
    PASS_CATALOG
} from '../services/supabase'

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
    const isLoading = ref(false)

    // ====== Passes d'accès ======
    const activePass = ref(null)
    const passHistory = ref([])
    const isLoadingPass = ref(false)

    const hasActivePass = computed(() => {
        if (!activePass.value) return false
        return new Date(activePass.value.expiresAt) > new Date()
    })

    const activePassInfo = computed(() => {
        if (!hasActivePass.value) return null
        const catalog = PASS_CATALOG[activePass.value.passType]
        if (!catalog) return null
        const expiresAt = new Date(activePass.value.expiresAt)
        const now = new Date()
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
        return {
            ...catalog,
            ...activePass.value,
            daysLeft,
            expiresFormatted: expiresAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
        }
    })

    /**
     * Charger le pass actif de l'utilisateur courant
     */
    const loadActivePass = async () => {
        if (!user.value) return
        isLoadingPass.value = true
        try {
            activePass.value = await supaGetActivePass(user.value.id)
            // Charger aussi le localStorage comme fallback
            if (!activePass.value) {
                const stored = localStorage.getItem('pdvstar_active_pass_' + user.value.id)
                if (stored) {
                    const pass = JSON.parse(stored)
                    if (new Date(pass.expiresAt) > new Date()) {
                        activePass.value = pass
                    } else {
                        localStorage.removeItem('pdvstar_active_pass_' + user.value.id)
                    }
                }
            }
        } catch (err) {
            console.error('Erreur chargement pass:', err)
        }
        isLoadingPass.value = false
    }

    /**
     * Acheter un pass
     */
    const buyPass = async (passType, paymentMethod, paymentRef) => {
        if (!user.value) return null
        isLoadingPass.value = true
        try {
            const pass = await supaPurchasePass(user.value.id, passType, paymentMethod, paymentRef)
            if (pass) {
                activePass.value = pass
                // Sauvegarder aussi en localStorage comme fallback
                localStorage.setItem('pdvstar_active_pass_' + user.value.id, JSON.stringify(pass))
            }
            isLoadingPass.value = false
            return pass
        } catch (err) {
            console.error('Erreur achat pass:', err)
            isLoadingPass.value = false
            return null
        }
    }

    /**
     * Charger l'historique des passes
     */
    const loadPassHistory = async () => {
        if (!user.value) return
        try {
            passHistory.value = await supaGetUserPasses(user.value.id)
        } catch (err) {
            console.error('Erreur chargement historique passes:', err)
        }
    }

    /**
     * Vérifier si l'utilisateur peut accéder à un contenu premium
     */
    const canAccessPremium = computed(() => {
        return hasActivePass.value
    })

    const isProfileComplete = computed(() => {
        return user.value && user.value.name && user.value.phone
    })

    /**
     * Login OR Register via Supabase, avec fallback local
     */
    const authenticate = async (profileData) => {
        isLoading.value = true
        let currentUser = null

        try {
            // 1. Chercher l'utilisateur par téléphone dans Supabase
            const existingUser = await supaFindUserByPhone(profileData.phone)

            if (existingUser) {
                // Login — utilisateur existant
                currentUser = existingUser
            } else {
                // Register — créer un nouvel utilisateur dans Supabase
                currentUser = await supaCreateUser({
                    name: profileData.name || `Utilisateur ${profileData.phone}`,
                    phone: profileData.phone,
                    email: profileData.email || '',
                    avatar: profileData.avatar || null,
                    following: [],
                    role: 'user'
                })
            }
        } catch (error) {
            console.error('❌ Erreur Supabase auth, fallback local:', error)
        }

        // Fallback local si Supabase échoue
        if (!currentUser) {
            let existingLocal = db.findUserByPhone(profileData.phone)
            if (existingLocal) {
                currentUser = existingLocal
            } else {
                currentUser = db.createUser({
                    name: profileData.name || `Utilisateur ${profileData.phone}`,
                    phone: profileData.phone,
                    email: profileData.email || '',
                    avatar: profileData.avatar || null,
                    following: [],
                    role: 'user'
                })
            }
        }

        user.value = currentUser
        saveSession()
        isLoading.value = false
        // Charger le pass actif après login
        loadActivePass()
        return user.value
    }

    const toggleFollow = async (organizerName) => {
        if (!user.value) return

        if (!user.value.following) {
            user.value.following = []
        }

        const idx = user.value.following.indexOf(organizerName)
        if (idx === -1) {
            user.value.following.push(organizerName)
        } else {
            user.value.following.splice(idx, 1)
        }

        // Persist to Supabase
        try {
            await supaUpdateUser(user.value.id, { following: user.value.following })
        } catch (error) {
            console.error('❌ Erreur update following Supabase:', error)
            // Fallback local
            db.updateUser(user.value.id, { following: user.value.following })
        }
        saveSession()
    }

    // Internal helper
    const saveSession = () => {
        const session = {
            user: user.value,
            expiry: Date.now() + (7 * 24 * 60 * 60 * 1000) // 1 Week
        }
        localStorage.setItem('pdvstar_session_user', JSON.stringify(session))
    }

    const updateProfile = async (updates) => {
        if (user.value) {
            let updated = null
            try {
                updated = await supaUpdateUser(user.value.id, updates)
            } catch (error) {
                console.error('❌ Erreur update profile Supabase:', error)
                updated = db.updateUser(user.value.id, updates)
            }

            if (updated) {
                user.value = updated
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

    const isOrganizer = computed(() => {
        return user.value && (user.value.role === 'organizer' || user.value.role === 'admin')
    })

    const becomeOrganizer = async (organizerData) => {
        if (!user.value) return false
        isLoading.value = true
        try {
            await updateProfile({
                role: 'organizer',
                spaceName: organizerData.spaceName,
                organizerName: organizerData.organizerName || user.value.name
            })
            isLoading.value = false
            return true
        } catch (error) {
            console.error('❌ Erreur devenir organisateur:', error)
            isLoading.value = false
            return false
        }
    }

    const logout = () => {
        user.value = null
        activePass.value = null
        passHistory.value = []
        localStorage.removeItem('pdvstar_session_user')
    }

    // Si l'utilisateur est déjà connecté, charger son pass
    if (user.value) {
        loadActivePass()
    }

    return {
        user,
        isLoading,
        isProfileComplete,
        isOrganizer,
        // Passes
        activePass,
        passHistory,
        isLoadingPass,
        hasActivePass,
        activePassInfo,
        canAccessPremium,
        loadActivePass,
        buyPass,
        loadPassHistory,
        // Actions
        authenticate,
        updateProfile,
        toggleFollow,
        becomeOrganizer,
        logout
    }
})
