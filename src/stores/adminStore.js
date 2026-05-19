import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../services/supabase'

/**
 * Vérifie la session admin : token Supabase valide + role=admin dans public.users
 */
export const checkAdminSession = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return false
        const { data } = await supabase
            .from('users')
            .select('role, role_v2')
            .eq('id', session.user.id)
            .single()
        return data?.role === 'admin' || data?.role_v2 === 'admin'
    } catch {
        return false
    }
}

export const useAdminStore = defineStore('admin', () => {
    const isAuthenticated = ref(false)
    const loginError = ref('')

    // Restaure la session au chargement
    supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return
        const { data } = await supabase
            .from('users')
            .select('role, role_v2')
            .eq('id', session.user.id)
            .single()
        if (data?.role === 'admin' || data?.role_v2 === 'admin') {
            isAuthenticated.value = true
        }
    })

    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT' || !session) isAuthenticated.value = false
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
        if (profile?.role !== 'admin' && profile?.role_v2 !== 'admin') {
            await supabase.auth.signOut()
            loginError.value = 'Accès refusé : compte non administrateur'
            return false
        }
        isAuthenticated.value = true
        return true
    }

    const logout = async () => {
        isAuthenticated.value = false
        await supabase.auth.signOut()
    }

    return { isAuthenticated, loginError, login, logout }
})


