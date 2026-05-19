import { ref, onUnmounted } from 'vue'

/**
 * Phase 4 — Dictée vocale via Web Speech API (natif, gratuit).
 * Usage:
 *   const { isListening, transcript, start, stop, supported } = useDictation('fr-FR')
 */
export function useDictation(lang = 'fr-FR') {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const supported = !!SR

    const isListening = ref(false)
    const transcript = ref('')
    const interim = ref('')
    const error = ref(null)

    let recognition = null

    const start = () => {
        if (!supported) {
            error.value = 'Reconnaissance vocale non supportée par ce navigateur'
            return
        }
        if (isListening.value) return

        recognition = new SR()
        recognition.lang = lang
        recognition.interimResults = true
        recognition.continuous = true
        recognition.maxAlternatives = 1

        recognition.onresult = (e) => {
            let finalT = ''
            let interimT = ''
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i]
                if (r.isFinal) finalT += r[0].transcript
                else interimT += r[0].transcript
            }
            if (finalT) transcript.value = (transcript.value + ' ' + finalT).trim()
            interim.value = interimT
        }
        recognition.onerror = (e) => {
            error.value = e.error
            isListening.value = false
        }
        recognition.onend = () => { isListening.value = false }

        try {
            recognition.start()
            isListening.value = true
            error.value = null
        } catch (e) {
            error.value = e.message
        }
    }

    const stop = () => {
        if (recognition && isListening.value) {
            recognition.stop()
        }
    }

    const reset = () => {
        transcript.value = ''
        interim.value = ''
        error.value = null
    }

    onUnmounted(() => { try { recognition?.abort() } catch {} })

    return { supported, isListening, transcript, interim, error, start, stop, reset }
}
