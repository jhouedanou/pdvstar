<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ChevronLeft, FileText, Shield, Scale } from 'lucide-vue-next'

const router = useRouter()
const route = useRoute()

const activeTab = ref(route.query.tab || 'cgu')

const appName = 'Babi Vibes'
const companyName = 'PDV Star SARL'
const lastUpdate = '15 juin 2025'
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white">
    <!-- Header -->
    <div class="sticky top-0 z-10 bg-white/90 dark:bg-black/90 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 px-4 py-3">
      <div class="max-w-2xl mx-auto flex items-center gap-3">
        <button @click="router.back()" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition">
          <ChevronLeft class="w-5 h-5" />
        </button>
        <h1 class="font-black text-lg">Mentions légales</h1>
      </div>
    </div>

    <!-- Tabs -->
    <div class="max-w-2xl mx-auto px-4 pt-4">
      <div class="flex gap-2 mb-6">
        <button @click="activeTab = 'cgu'" 
          class="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
          :class="activeTab === 'cgu' ? 'bg-primary text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'">
          <FileText class="w-4 h-4" /> CGU
        </button>
        <button @click="activeTab = 'cgv'"
          class="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
          :class="activeTab === 'cgv' ? 'bg-primary text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'">
          <Scale class="w-4 h-4" /> CGV
        </button>
        <button @click="activeTab = 'privacy'"
          class="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition"
          :class="activeTab === 'privacy' ? 'bg-primary text-black' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'">
          <Shield class="w-4 h-4" /> Confidentialité
        </button>
      </div>

      <!-- CGU -->
      <div v-if="activeTab === 'cgu'" class="prose prose-sm dark:prose-invert max-w-none pb-20">
        <p class="text-xs text-gray-500 mb-4">Dernière mise à jour : {{ lastUpdate }}</p>

        <h2>1. Objet</h2>
        <p>Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme <strong>{{ appName }}</strong> éditée par {{ companyName }}. En accédant à l'application, vous acceptez sans réserve les présentes CGU.</p>

        <h2>2. Description du service</h2>
        <p>{{ appName }} est une plateforme de découverte et de promotion d'événements. Elle permet aux utilisateurs de :</p>
        <ul>
          <li>Découvrir des événements à proximité</li>
          <li>S'inscrire à des événements</li>
          <li>Publier et gérer des événements en tant qu'organisateur</li>
          <li>Accéder à du contenu premium via des passes d'accès</li>
        </ul>

        <h2>3. Inscription et compte</h2>
        <p>L'inscription se fait via un numéro de téléphone. L'utilisateur garantit l'exactitude des informations fournies. Chaque compte est personnel et ne peut être cédé.</p>

        <h2>4. Obligations de l'utilisateur</h2>
        <p>L'utilisateur s'engage à :</p>
        <ul>
          <li>Ne pas publier de contenu illicite, offensant ou contraire à l'ordre public</li>
          <li>Respecter les droits de propriété intellectuelle</li>
          <li>Ne pas utiliser la plateforme à des fins frauduleuses</li>
          <li>Fournir des informations exactes pour les événements publiés</li>
        </ul>

        <h2>5. Modération</h2>
        <p>Les événements publiés par les organisateurs sont soumis à une validation préalable par l'équipe {{ appName }}. Tout contenu non conforme aux présentes CGU pourra être rejeté ou supprimé sans préavis.</p>

        <h2>6. Propriété intellectuelle</h2>
        <p>L'ensemble des éléments de la plateforme (design, logos, textes, code) est la propriété de {{ companyName }}. Toute reproduction est interdite sans autorisation écrite.</p>

        <h2>7. Limitation de responsabilité</h2>
        <p>{{ companyName }} ne saurait être tenu responsable des événements organisés par des tiers via la plateforme. L'organisateur reste seul responsable du déroulement de son événement.</p>

        <h2>8. Modification des CGU</h2>
        <p>{{ companyName }} se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle.</p>
      </div>

      <!-- CGV -->
      <div v-if="activeTab === 'cgv'" class="prose prose-sm dark:prose-invert max-w-none pb-20">
        <p class="text-xs text-gray-500 mb-4">Dernière mise à jour : {{ lastUpdate }}</p>

        <h2>1. Objet</h2>
        <p>Les présentes Conditions Générales de Vente (CGV) régissent les transactions commerciales réalisées via {{ appName }}, notamment l'achat de passes d'accès premium.</p>

        <h2>2. Produits et services</h2>
        <h3>2.1 Passes d'accès</h3>
        <ul>
          <li><strong>Pass Découverte</strong> : 5 000 CFA — Accès premium 3 jours</li>
          <li><strong>Pass Standard</strong> : 15 000 CFA — Accès premium 1 mois</li>
          <li><strong>Pass Premium</strong> : 30 000 CFA — Accès VIP 1 mois, sans publicité</li>
        </ul>

        <h2>3. Prix</h2>
        <p>Les prix sont indiqués en Francs CFA (XOF), toutes taxes comprises. {{ companyName }} se réserve le droit de modifier ses tarifs à tout moment. Les tarifs applicables sont ceux en vigueur au moment de la commande.</p>

        <h2>4. Modalités de paiement</h2>
        <p>Le paiement s'effectue par :</p>
        <ul>
          <li>Orange Money</li>
          <li>MTN Mobile Money</li>
          <li>Wave</li>
          <li>Carte bancaire</li>
        </ul>
        <p>Le pass est activé immédiatement après confirmation du paiement.</p>

        <h2>5. Droit de rétractation</h2>
        <p>Conformément à la nature digitale et immédiate des services fournis, le droit de rétractation ne s'applique pas aux passes d'accès une fois activés.</p>

        <h2>6. Durée et renouvellement</h2>
        <p>Les passes ont une durée limitée indiquée lors de l'achat. Le renouvellement n'est pas automatique. L'utilisateur sera notifié avant l'expiration de son pass.</p>

        <h2>7. Réclamations</h2>
        <p>Pour toute réclamation concernant un achat, contactez-nous à l'adresse indiquée dans l'application dans un délai de 7 jours suivant l'achat.</p>
      </div>

      <!-- Politique de confidentialité -->
      <div v-if="activeTab === 'privacy'" class="prose prose-sm dark:prose-invert max-w-none pb-20">
        <p class="text-xs text-gray-500 mb-4">Dernière mise à jour : {{ lastUpdate }}</p>

        <h2>1. Données collectées</h2>
        <p>{{ appName }} collecte les données suivantes :</p>
        <ul>
          <li>Nom et prénom</li>
          <li>Numéro de téléphone</li>
          <li>Adresse e-mail (optionnel)</li>
          <li>Données de géolocalisation (avec consentement)</li>
          <li>Historique des événements consultés et inscrits</li>
        </ul>

        <h2>2. Finalités</h2>
        <p>Les données sont utilisées pour :</p>
        <ul>
          <li>Gérer votre compte utilisateur</li>
          <li>Personnaliser votre expérience (recommandations, feed)</li>
          <li>Afficher des publicités pertinentes</li>
          <li>Améliorer nos services</li>
        </ul>

        <h2>3. Conservation</h2>
        <p>Les données sont conservées pendant la durée d'utilisation du service et supprimées 12 mois après la dernière connexion, sauf obligation légale contraire.</p>

        <h2>4. Partage</h2>
        <p>Les données ne sont pas vendues à des tiers. Elles peuvent être partagées avec :</p>
        <ul>
          <li>Les organisateurs d'événements auxquels vous vous inscrivez (nom et téléphone)</li>
          <li>Les prestataires techniques (hébergement, paiement)</li>
        </ul>

        <h2>5. Vos droits</h2>
        <p>Vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, contactez-nous via l'application.</p>

        <h2>6. Cookies</h2>
        <p>L'application utilise le stockage local (localStorage) pour maintenir votre session et vos préférences. Aucun cookie tiers n'est utilisé.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose h2 {
  @apply text-lg font-bold mt-6 mb-2 text-gray-900 dark:text-white;
}
.prose h3 {
  @apply text-base font-semibold mt-4 mb-1 text-gray-800 dark:text-gray-200;
}
.prose p {
  @apply text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3;
}
.prose ul {
  @apply text-sm text-gray-600 dark:text-gray-400 list-disc pl-5 space-y-1 mb-3;
}
.prose li {
  @apply leading-relaxed;
}
</style>
