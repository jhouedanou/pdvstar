/**
 * Phase 4 — Génération IA de descriptions événement via Groq.
 * Doc: https://console.groq.com/docs
 * Modèle gratuit rapide: llama-3.3-70b-versatile
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

function getKey() {
    const k = import.meta.env.VITE_GROQ_API_KEY
    if (!k) throw new Error('VITE_GROQ_API_KEY manquant')
    return k
}

/**
 * Génère une description FR ~80 mots à partir des infos event.
 */
export async function generateEventDescription({ title, location, date, tags = [], extra = '' }) {
    const prompt = `Tu es un copywriter pour une app d'événements à Abidjan.
Rédige une description vendeuse de 60 à 90 mots, ton chaleureux, vocabulaire ivoirien moderne, sans emojis exagérés.

Titre: ${title}
Lieu: ${location || 'non précisé'}
Date: ${date || 'non précisée'}
Tags: ${tags.join(', ') || 'aucun'}
Notes: ${extra || 'aucune'}

Réponds uniquement avec la description, sans préambule.`

    const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getKey()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 250
        })
    })

    if (!res.ok) {
        const err = await res.text()
        throw new Error('Groq API error: ' + err)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content?.trim() || ''
}

/**
 * Suggestions de tags pour un event donné.
 */
export async function suggestTags({ title, description }) {
    const prompt = `Donne 3 à 5 tags courts (1 mot, minuscules, sans #) pour cet événement.
Réponds en JSON array uniquement: ["tag1","tag2"]

Titre: ${title}
Description: ${description}`

    const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getKey()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4,
            max_tokens: 60
        })
    })
    if (!res.ok) return []
    const data = await res.json()
    const txt = data.choices?.[0]?.message?.content || '[]'
    try { return JSON.parse(txt.match(/\[.*\]/s)?.[0] || '[]') } catch { return [] }
}
