<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/adminStore'
import { useEventStore } from '../stores/eventStore'
import { 
    LogOut, Plus, Edit, Trash2, Calendar, MapPin, 
    X, Check, Camera, Save, ArrowLeft 
} from 'lucide-vue-next'

const router = useRouter()
const adminStore = useAdminStore()
const eventStore = useEventStore()

// State
const showCreateModal = ref(false)
const showEditModal = ref(false)
const editingEvent = ref(null)
const deleteConfirmId = ref(null)

// Form data
const defaultForm = () => ({
    title: '',
    description: '',
    date: new Date().toISOString().slice(0, 16),
    location: '',
    organizer: '',
    image: '',
    preview: '',
    coords: { lat: 5.30966, lng: -3.97449 },
    isPremium: false,
    price: 0
})

const form = ref(defaultForm())

// Events list
const events = computed(() => eventStore.events)

// Handle logout
const handleLogout = () => {
    adminStore.logout()
    router.push('/admin')
}

// Handle image selection
const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
            form.value.preview = ev.target.result
            form.value.image = ev.target.result
        }
        reader.readAsDataURL(file)
    }
}

// Open create modal
const openCreateModal = () => {
    form.value = defaultForm()
    showCreateModal.value = true
}

// Close modals
const closeModals = () => {
    showCreateModal.value = false
    showEditModal.value = false
    editingEvent.value = null
    form.value = defaultForm()
}

// Create event
const createEvent = () => {
    eventStore.addEvent({
        title: form.value.title || 'Événement Sans Titre',
        description: form.value.description || 'Pas de description',
        date: form.value.date,
        location: form.value.location || 'Abidjan',
        organizer: form.value.organizer || 'Admin',
        image: form.value.image || form.value.preview,
        coords: form.value.coords,
        isPremium: form.value.isPremium,
        price: form.value.isPremium ? form.value.price : 0,
        distance: '0 km'
    })
    closeModals()
}

// Open edit modal
const openEditModal = (event) => {
    editingEvent.value = event
    form.value = {
        title: event.title,
        description: event.description,
        date: event.date.slice(0, 16),
        location: event.location,
        organizer: event.organizer,
        image: event.image,
        preview: event.image,
        coords: event.coords || { lat: 5.30966, lng: -3.97449 },
        isPremium: event.isPremium || false,
        price: event.price || 0
    }
    showEditModal.value = true
}

// Update event
const updateEvent = () => {
    if (editingEvent.value) {
        eventStore.updateEvent(editingEvent.value.id, {
            title: form.value.title,
            description: form.value.description,
            date: form.value.date,
            location: form.value.location,
            organizer: form.value.organizer,
            image: form.value.image || form.value.preview,
            coords: form.value.coords,
            isPremium: form.value.isPremium,
            price: form.value.isPremium ? form.value.price : 0
        })
        closeModals()
    }
}

// Delete event
const confirmDelete = (eventId) => {
    deleteConfirmId.value = eventId
}

const cancelDelete = () => {
    deleteConfirmId.value = null
}

const deleteEvent = (eventId) => {
    eventStore.deleteEvent(eventId)
    deleteConfirmId.value = null
}

// Format date for display
const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}
</script>

<template>
  <div class="min-h-screen bg-black">
    <!-- Header -->
    <header class="bg-surface border-b border-gray-800 px-4 py-3 sticky top-0 z-40">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-bold text-primary">Admin Dashboard</h1>
        </div>
        <div class="flex items-center gap-4">
          <router-link to="/" class="text-gray-400 text-sm hover:text-white transition flex items-center gap-1">
            <ArrowLeft class="w-4 h-4" />
            Voir le site
          </router-link>
          <button @click="handleLogout" class="flex items-center gap-2 text-red-400 hover:text-red-300 transition">
            <LogOut class="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-6xl mx-auto p-4">
      <!-- Stats & Actions -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 class="text-2xl font-bold text-white">Gestion des Événements</h2>
          <p class="text-gray-400">{{ events.length }} événement(s) au total</p>
        </div>
        <button 
          @click="openCreateModal"
          class="bg-primary text-black font-bold px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-primary/90 transition"
        >
          <Plus class="w-5 h-5" />
          Nouvel Événement
        </button>
      </div>

      <!-- Events Grid -->
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div 
          v-for="event in events" 
          :key="event.id"
          class="bg-surface rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 transition"
        >
          <img :src="event.image" :alt="event.title" class="w-full h-40 object-cover" />
          <div class="p-4">
            <h3 class="font-bold text-white truncate">{{ event.title }}</h3>
            <div class="flex items-center gap-2 text-gray-400 text-sm mt-1">
              <Calendar class="w-4 h-4" />
              {{ formatDate(event.date) }}
            </div>
            <div class="flex items-center gap-2 text-gray-400 text-sm mt-1">
              <MapPin class="w-4 h-4" />
              {{ event.location }}
            </div>
            <div v-if="event.isPremium" class="mt-2">
              <span class="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">Premium - {{ event.price }} CFA</span>
            </div>
            
            <!-- Actions -->
            <div class="flex gap-2 mt-4">
              <button 
                @click="openEditModal(event)"
                class="flex-1 bg-gray-800 text-white py-2 rounded-lg flex items-center justify-center gap-1 hover:bg-gray-700 transition"
              >
                <Edit class="w-4 h-4" />
                Modifier
              </button>
              <button 
                v-if="deleteConfirmId !== event.id"
                @click="confirmDelete(event.id)"
                class="bg-red-500/20 text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/30 transition"
              >
                <Trash2 class="w-4 h-4" />
              </button>
              <div v-else class="flex gap-1">
                <button 
                  @click="deleteEvent(event.id)"
                  class="bg-red-500 text-white px-3 py-2 rounded-lg hover:bg-red-600 transition"
                >
                  <Check class="w-4 h-4" />
                </button>
                <button 
                  @click="cancelDelete"
                  class="bg-gray-700 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition"
                >
                  <X class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="events.length === 0" class="text-center py-16">
        <p class="text-gray-400 text-lg mb-4">Aucun événement pour le moment</p>
        <button 
          @click="openCreateModal"
          class="bg-primary text-black font-bold px-6 py-3 rounded-xl inline-flex items-center gap-2 hover:bg-primary/90 transition"
        >
          <Plus class="w-5 h-5" />
          Créer le premier événement
        </button>
      </div>
    </main>

    <!-- Create/Edit Modal -->
    <Teleport to="body">
      <div 
        v-if="showCreateModal || showEditModal" 
        class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        @click.self="closeModals"
      >
        <div class="bg-surface rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div class="p-4 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-surface">
            <h3 class="text-xl font-bold text-white">
              {{ showEditModal ? 'Modifier l\'événement' : 'Nouvel Événement' }}
            </h3>
            <button @click="closeModals" class="text-gray-400 hover:text-white transition">
              <X class="w-6 h-6" />
            </button>
          </div>

          <form @submit.prevent="showEditModal ? updateEvent() : createEvent()" class="p-4 space-y-4">
            <!-- Image -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Image de l'événement</label>
              <label class="block w-full h-40 bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-primary transition overflow-hidden">
                <div v-if="form.preview" class="w-full h-full">
                  <img :src="form.preview" class="w-full h-full object-cover" />
                </div>
                <div v-else class="w-full h-full flex flex-col items-center justify-center">
                  <Camera class="w-8 h-8 text-gray-600 mb-2" />
                  <span class="text-gray-500 text-sm">Cliquer pour ajouter une image</span>
                </div>
                <input type="file" accept="image/*" @change="handleImageChange" class="hidden" />
              </label>
            </div>

            <!-- Title -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Titre *</label>
              <input 
                v-model="form.title" 
                type="text" 
                placeholder="Ex: Soirée Coupé Décalé"
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                required
              />
            </div>

            <!-- Date -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Date et heure *</label>
              <input 
                v-model="form.date" 
                type="datetime-local"
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                required
              />
            </div>

            <!-- Location -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Lieu</label>
              <input 
                v-model="form.location" 
                type="text" 
                placeholder="Ex: Cocody, Zone 4..."
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
              />
            </div>

            <!-- Organizer -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Organisateur</label>
              <input 
                v-model="form.organizer" 
                type="text" 
                placeholder="Ex: Babi Event"
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
              />
            </div>

            <!-- Description -->
            <div>
              <label class="block text-gray-400 text-sm mb-2">Description</label>
              <textarea 
                v-model="form.description" 
                rows="3"
                placeholder="Décrivez votre événement..."
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition resize-none"
              ></textarea>
            </div>

            <!-- Premium Toggle -->
            <div class="flex items-center gap-3">
              <input 
                v-model="form.isPremium" 
                type="checkbox" 
                id="isPremium"
                class="w-5 h-5 rounded bg-gray-900 border-gray-700 text-primary focus:ring-primary"
              />
              <label for="isPremium" class="text-white">Événement Premium</label>
            </div>

            <!-- Price (if premium) -->
            <div v-if="form.isPremium">
              <label class="block text-gray-400 text-sm mb-2">Prix (CFA)</label>
              <input 
                v-model.number="form.price" 
                type="number" 
                min="0"
                placeholder="Ex: 5000"
                class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
              />
            </div>

            <!-- Coordinates -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-gray-400 text-sm mb-2">Latitude</label>
                <input 
                  v-model.number="form.coords.lat" 
                  type="number" 
                  step="0.00001"
                  class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                />
              </div>
              <div>
                <label class="block text-gray-400 text-sm mb-2">Longitude</label>
                <input 
                  v-model.number="form.coords.lng" 
                  type="number" 
                  step="0.00001"
                  class="w-full bg-gray-900 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-primary focus:outline-none transition"
                />
              </div>
            </div>

            <!-- Submit -->
            <button 
              type="submit"
              class="w-full bg-primary text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition"
            >
              <Save class="w-5 h-5" />
              {{ showEditModal ? 'Enregistrer les modifications' : 'Créer l\'événement' }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
