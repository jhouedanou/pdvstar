import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'
import { checkAdminSession } from './stores/adminStore'
import { SESSION_KEYS, USER_SESSION_DURATION_MS, readSession, writeSession } from './utils/sessionStorage'

const FeedUser = () => import('./views/FeedUser.vue')
const ProfilePage = () => import('./views/ProfilePage.vue')
const ProDashboard = () => import('./views/ProDashboard.vue')
const CreateEventWizard = () => import('./components/CreateEventWizard.vue')
const OrganizerEventDetail = () => import('./views/OrganizerEventDetail.vue')
const AdminLogin = () => import('./views/AdminLogin.vue')
const AdminDashboard = () => import('./views/AdminDashboard.vue')
const AdminEventDetail = () => import('./views/AdminEventDetail.vue')
const AdminStats = () => import('./views/AdminStats.vue')
const AdminSplash = () => import('./views/AdminSplash.vue')
const AdminMedia = () => import('./views/AdminMedia.vue')
const AdminSettings = () => import('./views/AdminSettings.vue')
const AdminUsers = () => import('./views/AdminUsers.vue')
const AdminReports = () => import('./views/AdminReports.vue')
const AdminNotifications = () => import('./views/AdminNotifications.vue')
const AdsDashboard = () => import('./views/AdsDashboard.vue')
const LegalPages = () => import('./views/LegalPages.vue')
const TicketPurchase = () => import('./views/TicketPurchase.vue')
const TicketScan = () => import('./views/TicketScan.vue')

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
    { path: '/admin/notifications', component: AdminNotifications, meta: { requiresAdmin: true } },
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
    const session = readSession(SESSION_KEYS.user)
    if (!session?.user) return null

    // Prolonge la session aussi lors des checks de navigation.
    writeSession(SESSION_KEYS.user, session.user, USER_SESSION_DURATION_MS)

    // Normalise role legacy 'user' -> 'consumer'
    const r = session.user.role
    if (r === 'user' || !r) return 'consumer'
    return r
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
