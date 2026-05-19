<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '../stores/adminStore'
import {
    LayoutDashboard, Megaphone, BarChart2, Image, SlidersHorizontal,
    LogOut, ExternalLink, ChevronRight, ShieldCheck, Settings,
    Users, Flag
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()

const nav = [
    {
        group: 'Contenu',
        items: [
            { label: 'Événements', icon: LayoutDashboard, to: '/admin/dashboard' },
            { label: 'Publicités', icon: Megaphone, to: '/admin/ads' },
            { label: 'Statistiques', icon: BarChart2, to: '/admin/stats' },
        ]
    },
    {
        group: 'Modération',
        items: [
            { label: 'Utilisateurs', icon: Users, to: '/admin/users' },
            { label: 'Signalements', icon: Flag, to: '/admin/reports' },
        ]
    },
    {
        group: 'Médias & App',
        items: [
            { label: 'Médiathèque', icon: Image, to: '/admin/media' },
            { label: 'Splash Screen', icon: SlidersHorizontal, to: '/admin/splash' },
            { label: 'Paramètres app', icon: Settings, to: '/admin/settings' },
        ]
    },
]

const isActive = (to) => route.path === to || route.path.startsWith(to + '/')

const logout = () => {
    adminStore.logout()
    router.push('/admin')
}

const breadcrumb = computed(() => {
    const map = {
        '/admin/dashboard': 'Événements',
        '/admin/ads': 'Publicités',
        '/admin/stats': 'Statistiques',
        '/admin/users': 'Utilisateurs',
        '/admin/reports': 'Signalements',
        '/admin/media': 'Médiathèque',
        '/admin/splash': 'Splash Screen',
        '/admin/settings': 'Paramètres',
    }
    return map[route.path] || 'Admin'
})
</script>

<template>
  <div class="admin-shell">
    <!-- Sidebar -->
    <aside class="admin-sidebar">
      <div class="sidebar-logo">
        <ShieldCheck class="w-5 h-5 text-blue-400" />
        <span class="font-bold tracking-tight">Admin</span>
      </div>

      <nav class="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div v-for="section in nav" :key="section.group">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-2 mb-1.5">
            {{ section.group }}
          </p>
          <ul class="space-y-0.5">
            <li v-for="item in section.items" :key="item.to">
              <router-link
                :to="item.to"
                class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all"
                :class="isActive(item.to)
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/60'"
              >
                <component :is="item.icon" class="w-4 h-4 flex-shrink-0" />
                {{ item.label }}
              </router-link>
            </li>
          </ul>
        </div>
      </nav>

      <div class="border-t border-slate-700/60 px-3 py-3 space-y-0.5">
        <a
          href="/"
          target="_blank"
          class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
        >
          <ExternalLink class="w-4 h-4" />
          Voir l'app
        </a>
        <button
          @click="logout"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut class="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="admin-main">
      <!-- Topbar -->
      <header class="admin-topbar">
        <div class="flex items-center gap-2 text-sm text-slate-400">
          <span>Admin</span>
          <ChevronRight class="w-3.5 h-3.5" />
          <span class="text-white font-medium">{{ breadcrumb }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs text-slate-500 hidden sm:block">admin</span>
          <div class="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">A</div>
        </div>
      </header>

      <!-- Content -->
      <main class="admin-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  display: flex;
  min-height: 100dvh;
  background: #0f172a;
  color: #f8fafc;
  font-family: 'Inter', system-ui, sans-serif;
}

.admin-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #1e293b;
  border-right: 1px solid rgba(148,163,184,0.1);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow: hidden;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(148,163,184,0.1);
  font-size: 15px;
  color: #f1f5f9;
}

.admin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.admin-topbar {
  height: 52px;
  border-bottom: 1px solid rgba(148,163,184,0.1);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #0f172a;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.admin-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

/* Mobile : sidebar cachée, layout vertical */
@media (max-width: 768px) {
  .admin-sidebar {
    display: none;
  }
}
</style>
