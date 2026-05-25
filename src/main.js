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
import TicketPurchase from './views/TicketPurchase.vue'
import TicketScan from './views/TicketScan.vue'
import ProfilePage from './views/ProfilePage.vue'
import OrganizerEventDetail from './views/OrganizerEventDetail.vue'
import AdminEventDetail from './views/AdminEventDetail.vue'
import AdminStats from './views/AdminStats.vue'
import AdminSplash from './views/AdminSplash.vue'
import AdminMedia from './views/AdminMedia.vue'
import AdminSettings from './views/AdminSettings.vue'
import AdminUsers from './views/AdminUsers.vue'
import AdminReports from './views/AdminReports.vue'

const routes = [
    { path: '/', component: FeedUser }, // Default to User Feed
    { path: '/profile', component: ProfilePage },
    { path: '/pro', component: ProDashboard, meta: { requiresRole: ['organizer', 'admin'] } },
    { path: '/pro/create', component: CreateEventWizard, meta: { requiresRole: ['organizer', 'admin'] } },
    { path: '/organizer', component: ProDashboard, meta: { requiresRole: ['organizer', 'admin'] } },
    { path: '/organizer/events/new', component: CreateEventWizard, meta: { requiresRole: ['organizer', 'admin'] } },
    { path: '/organizer/events/:id', component: OrganizerEventDetail, meta: { requiresRole: ['organizer', 'admin'] } },
    { path: '/organizer/ads', component: AdsDashboard, meta: { requiresRole: ['organizer', 'admin'] } },
    { path: '/admin', component: AdminLogin },
    { path: '/admin/dashboard', component: AdminDashboard, meta: { requiresAdmin: true } },
    { path: '/admin/events', component: AdminDashboard, meta: { requiresAdmin: true } },
    { path: '/admin/events/:id', component: AdminEventDetail, meta: { requiresAdmin: true } },
    { path: '/admin/ads', component: AdsDashboard, meta: { requiresAdmin: true } },
    { path: '/admin/stats', component: AdminStats, meta: { requiresAdmin: true } },
    { path: '/admin/media', component: AdminMedia, meta: { requiresAdmin: true } },
    { path: '/admin/splash', component: AdminSplash, meta: { requiresAdmin: true } },
    { path: '/admin/settings', component: AdminSettings, meta: { requiresAdmin: true } },
    { path: '/admin/users', component: AdminUsers, meta: { requiresAdmin: true } },
    { path: '/admin/reports', component: AdminReports, meta: { requiresAdmin: true } },
    { path: '/billet/:id', component: TicketPurchase },
    { path: '/billet/scan/:eventId?', component: TicketScan, meta: { requiresRole: ['organizer', 'admin'] } },
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
router.beforeEach(async (to, from, next) => {
    if (to.meta.requiresAdmin) {
        const ok = await checkAdminSession()
        if (ok || hasRole(['admin'])) return next()
        return next('/admin')
    }
    if (to.meta.requiresRole) {
        const ok = await checkAdminSession()
        if (ok) return next('/admin/dashboard')
        if (hasRole(to.meta.requiresRole)) return next()
        // Non autorisé : connexion organisateur sur /pro (jamais /admin, réservé aux admins).
        // ProDashboard affiche sa propre modale de connexion, on le laisse donc passer.
        if (to.path === '/pro') return next()
        return next('/pro')
    }
    next()
})

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
app.mount('#app')
