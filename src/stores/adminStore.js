import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../services/supabase'
import { ADMIN_SESSION_DURATION_MS, SESSION_KEYS, clearSession, readSession, writeSession } from '../utils/sessionStorage'

const isAdminUser = (user) => user?.role === 'admin' || user?.role_v2 === 'admin'

/**
 * Vérifie la session admin : token Supabase valide + role=admin dans public.users
 */
export const checkAdminSession = async () => {
    // Check phone-based session first
    const storedSession = readSession(SESSION_KEYS.admin)
    if (isAdminUser(storedSession?.user)) {
        // Durée glissante : une session admin valide est prolongée à chaque contrôle.
        writeSession(SESSION_KEYS.admin, storedSession.user, ADMIN_SESSION_DURATION_MS)
        return true
    }

    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return false
        const { data } = await supabase
            .from('users')
            .select('role, role_v2')
            .eq('id', session.user.id)
            .single()
        return isAdminUser(data)
    } catch {
        return false
    }
}

export const useAdminStore = defineStore('admin', () => {
    const isAuthenticated = ref(false)
    const loginError = ref('')

    // Restaure session phone-based
    const storedSession = readSession(SESSION_KEYS.admin)
    if (isAdminUser(storedSession?.user)) {
        isAuthenticated.value = true
        writeSession(SESSION_KEYS.admin, storedSession.user, ADMIN_SESSION_DURATION_MS)
    }

    // Restaure la session Supabase Auth (legacy)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return
        const { data } = await supabase
            .from('users')
            .select('role, role_v2')
            .eq('id', session.user.id)
            .single()
        if (isAdminUser(data)) {
            isAuthenticated.value = true
        }
    })

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
            const stored2 = readSession(SESSION_KEYS.admin)
            if (!stored2) isAuthenticated.value = false
        }
    })

    const login = async (email, password) => {
        loginError.value = ''
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
            loginError.value = 'Identifiants incorrects'
            return false
        }
        // Vérification du rôle admin dans public.users
        const { data: profile } = await supabase
            .from('users')
            .select('role, role_v2')
            .eq('id', data.user.id)
            .single()
        if (!isAdminUser(profile)) {
            await supabase.auth.signOut()
            loginError.value = 'Accès refusé : compte non administrateur'
            return false
        }
        isAuthenticated.value = true
        return true
    }

    const logout = async () => {
        isAuthenticated.value = false
        clearSession(SESSION_KEYS.admin)
        await supabase.auth.signOut()
    }

    return { isAuthenticated, loginError, login, logout }
})

