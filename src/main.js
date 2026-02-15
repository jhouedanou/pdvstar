import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'

// Basic Routes Placeholder
import ProDashboard from './views/ProDashboard.vue'
import FeedUser from './views/FeedUser.vue'
import CreateEventWizard from './components/CreateEventWizard.vue'
import AdminLogin from './views/AdminLogin.vue'
import AdminDashboard from './views/AdminDashboard.vue'

const routes = [
    { path: '/', component: FeedUser }, // Default to User Feed
    { path: '/pro', component: ProDashboard },
    { path: '/pro/create', component: CreateEventWizard },
    { path: '/admin', component: AdminLogin },
    { path: '/admin/dashboard', component: AdminDashboard, meta: { requiresAdmin: true } },
]

const router = createRouter({
    history: createWebHistory(),
    routes,
})

// Navigation guard for admin routes
router.beforeEach((to, from, next) => {
    if (to.meta.requiresAdmin) {
        const stored = localStorage.getItem('pdvstar_admin_session')
        if (stored) {
            const session = JSON.parse(stored)
            // Check if authenticated and not expired
            if (session.isAuthenticated && session.expiry && Date.now() <= session.expiry) {
                next()
                return
            }
        }
        // Redirect to admin login if not authenticated
        next('/admin')
    } else {
        next()
    }
})

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
app.mount('#app')
