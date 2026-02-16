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

const routes = [
    { path: '/', component: FeedUser }, // Default to User Feed
    { path: '/pro', component: ProDashboard },
    { path: '/pro/create', component: CreateEventWizard },
    { path: '/admin', component: AdminLogin },
    { path: '/admin/dashboard', component: AdminDashboard, meta: { requiresAdmin: true } },
    { path: '/admin/ads', component: AdsDashboard, meta: { requiresAdmin: true } },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

// Check if user is organizer from session
const checkOrganizerSession = () => {
    const stored = localStorage.getItem('pdvstar_session_user')
    if (stored) {
        try {
            const session = JSON.parse(stored)
            if (session.user && session.expiry && Date.now() <= session.expiry) {
                return session.user.role === 'organizer' || session.user.role === 'admin'
            }
        } catch (e) { /* ignore */ }
    }
    return false
}

// Navigation guard for admin routes (admin OR organizer)
router.beforeEach((to, from, next) => {
    if (to.meta.requiresAdmin) {
        if (checkAdminSession() || checkOrganizerSession()) {
            next()
        } else {
            next('/admin')
        }
    } else {
        next()
    }
})

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
app.mount('#app')
