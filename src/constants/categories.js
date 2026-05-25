// Liste unifiée des catégories d'événements
// Utilisée par CreateEventWizard (assignation) ET FeedUser (filtrage)

export const EVENT_CATEGORIES = [
    { v: 'soiree', l: 'Soirée', emoji: '🌙' },
    { v: 'musique', l: 'Musique', emoji: '🎵' },
    { v: 'dj', l: 'DJ / Club', emoji: '🎧' },
    { v: 'festival', l: 'Festival', emoji: '🎪' },
    { v: 'brunch', l: 'Brunch', emoji: '🥂' },
    { v: 'afterwork', l: 'Afterwork', emoji: '🍹' },
    { v: 'sport', l: 'Sport', emoji: '⚽' },
    { v: 'art', l: 'Art & Culture', emoji: '🎨' },
    { v: 'comedie', l: 'Comédie', emoji: '😂' }
]

// Dériver une catégorie depuis le titre/features quand absente
// Utilisé en fallback pour le filtrage fuzzy
export const deriveCategoryFromText = (title = '', features = []) => {
    const text = `${title} ${(features || []).join(' ')}`.toLowerCase()
    if (/\bbrunch\b/.test(text)) return 'brunch'
    if (/\bdj\b|\bclub\b|\b[eé]lectro\b|\btechno\b|\bhouse music\b/.test(text)) return 'dj'
    if (/\bfestival\b/.test(text)) return 'festival'
    if (/\bsport\b|\bfoot(ball)?\b|\bbasket\b|\bmatch\b|\btournoi\b|\bcomp[eé]tition\b/.test(text)) return 'sport'
    if (/\bart\b|\bexpo(sition)?\b|\bculture\b|\bgalerie\b|\bth[eé][aâ]tre\b|\bvernissage\b/.test(text)) return 'art'
    if (/\bcom[eé]die\b|\bhumour\b|\bstand[\s-]?up\b|\bkaraoké?\b/.test(text)) return 'comedie'
    if (/\bafterwork\b|\bafter work\b/.test(text)) return 'afterwork'
    if (/\bconcert\b|\blive\b|\bzouglou\b|\brap\b|\bgospel\b|\bafrobeat\b|\bmusique\b|\bcoup[eé][\s-]d[eé]cal[eé]\b|\breggae\b|\bjazz\b|\br[n&]b\b/.test(text)) return 'musique'
    if (/\bsoir[eé]e\b|\bparty\b|\bnuit\b|\bbo[iî]te\b|\bnightlife\b|\bgala\b/.test(text)) return 'soiree'
    return ''
}

// Match fuzzy : retourne true si event correspond à categoryFilter
// 1. match exact sur event.category
// 2. fallback via dérivation titre/features
// 3. soirée = inclusif (event nocturne sans catégorie compte)
export const matchesCategory = (event, categoryFilter) => {
    if (!categoryFilter || categoryFilter === 'all') return true
    const stored = (event.category || '').toLowerCase()
    if (stored === categoryFilter) return true
    const derived = deriveCategoryFromText(event.title, event.features)
    if (derived === categoryFilter) return true
    // Soirée : inclusif si event en soirée (>= 18h) sans catégorie définie
    if (categoryFilter === 'soiree' && !stored) {
        try {
            const h = new Date(event.date).getHours()
            if (h >= 18 || h <= 4) return true
        } catch {}
    }
    return false
}
