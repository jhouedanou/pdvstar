import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'
import { checkAdminSession } from './stores/adminStore'

// Basic Routes Placeholder
import ProDashboard from './views/ProDashboard.vue'
import FeedUser from './views/FeedUser.vue'
import CreateEventWizard from './components/CreateEventWizard.vue'
import AdminLogin from './views/AdminLogin.vue'
import AdminDashboard from './views/AdminDashboard.vue'
import AdsDashboard from './views/AdsDashboard.vue'
import LegalPages from './views/LegalPages.vue'

const routes = [
    { path: '/', component: FeedUser }, // Default to User Feed
    { path: '/pro', component: ProDashboard, meta: { requiresRole: ['organizer', 'admin'] } },
    { path: '/pro/create', component: CreateEventWizard, meta: { requiresRole: ['organizer', 'admin'] } },
    { path: '/admin', component: AdminLogin },
    { path: '/admin/dashboard', component: AdminDashboard, meta: { requiresAdmin: true } },
    { path: '/admin/ads', component: AdsDashboard, meta: { requiresAdmin: true } },
    { path: '/legal', component: LegalPages },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

// Lit le rôle du user en session
const getSessionRole = () => {
    const stored = localStorage.getItem('pdvstar_session_user')
    if (!stored) return null
    try {
        const session = JSON.parse(stored)
        if (session.user && session.expiry && Date.now() <= session.expiry) {
            // Normalise role legacy 'user' -> 'consumer'
            const r = session.user.role
            if (r === 'user' || !r) return 'consumer'
            return r
        }
    } catch (e) { /* ignore */ }
    return null
}

const hasRole = (allowed) => {
    const r = getSessionRole()
    return r && allowed.includes(r)
}

// Navigation guards : admin OU rôles applicatifs
router.beforeEach((to, from, next) => {
    if (to.meta.requiresAdmin) {
        if (checkAdminSession() || hasRole(['organizer', 'admin'])) return next()
        return next('/admin')
    }
    if (to.meta.requiresRole) {
        if (checkAdminSession() || hasRole(to.meta.requiresRole)) return next()
        return next('/admin')
    }
    next()
})

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
app.mount('#app')
