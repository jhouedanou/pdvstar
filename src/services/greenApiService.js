/**
 * GreenAPI service for WhatsApp messages.
 */

const getGreenApiConfig = () => ({
    apiUrl: import.meta.env.VITE_GREEN_API_URL,
    idInstance: import.meta.env.VITE_GREEN_ID_INSTANCE,
    apiToken: import.meta.env.VITE_GREEN_API_TOKEN
})

const cleanIvorianPhoneNumber = (phoneNumber) => {
    // WhatsApp Côte d'Ivoire utilise l'ancien format 8 chiffres.
    // Format moderne (10 chiffres avec préfixe 07/05/01/27/25/21) doit être strippé.
    // Exemples :
    //   +2250748348221 (13 chars) → +22548348221 (11 chars) [strip "07"]
    //   +2250545029721 (13 chars) → +22545029721 (11 chars) [strip "05"]
    //   +22548348221  (11 chars) → inchangé (déjà ancien format)
    const digits = phoneNumber.replace(/[^\d]/g, '')
    if (!digits.startsWith('225')) return phoneNumber

    const local = digits.slice(3) // ce qui est après "225"

    // Format moderne (10 digits) → strip operator prefix (2 premiers chiffres)
    if (local.length === 10) {
        return '+225' + local.slice(2)
    }
    // Doublon (12+ digits) → strip jusqu'à 8
    if (local.length > 10) {
        return '+225' + local.slice(local.length - 8)
    }
    // 8 digits ou moins : déjà bon format
    return phoneNumber
}

export const sendWhatsAppMessage = async (phoneNumber, message) => {
    const config = getGreenApiConfig()

    if (!config.apiUrl || !config.idInstance || !config.apiToken) {
        throw new Error('GreenAPI configuration is missing. Check your .env file.')
    }

    if (!phoneNumber || !phoneNumber.startsWith('+')) {
        throw new Error('Phone number must be in international format (e.g., +22545029721)')
    }

    const cleanedPhoneNumber = cleanIvorianPhoneNumber(phoneNumber)
    const cleanPhone = cleanedPhoneNumber.replace(/[^\d]/g, '')
    const endpoint = `${config.apiUrl}/waInstance${config.idInstance}/sendMessage/${config.apiToken}`

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chatId: `${cleanPhone}@c.us`,
            message
        })
    })

    if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`GreenAPI Error: ${errorData.message || response.statusText}`)
    }

    const data = await response.json()
    return {
        success: true,
        messageId: data.idMessage,
        timestamp: new Date().toISOString()
    }
}

export const formatEventNotificationMessage = (event, userName, userPhone) => {
    return `Nouvel inscrit pour l'evenement "${event.title}"
Lieu: ${event.location}
Nom: ${userName}
Telephone: ${userPhone}
Date: ${new Date().toLocaleString('fr-FR')}`
}

export const sendEventNotification = async (event, userName, userPhone) => {
    const message = formatEventNotificationMessage(event, userName, userPhone)
    const result = await sendWhatsAppMessage(userPhone, message)
    return {
        success: true,
        organizerMessage: result,
        userMessage: null
    }
}

export const formatAttendanceMessage = (event, profile) => {
    const location = [profile.city, profile.district].filter(Boolean).join(' / ') || 'Non renseignee'
    return `Nouveau participant interesse

Evenement : ${event.title}
Nom/Pseudo : ${profile.pseudo || profile.name || 'Participant'}
Telephone : ${profile.phone}
Localisation : ${location}
Date : ${event.date ? new Date(event.date).toLocaleString('fr-FR') : 'Non renseignee'}

Source : Babi Vibes`
}

export const formatUserConfirmationMessage = (event) => {
    const date = event.date ? new Date(event.date).toLocaleString('fr-FR') : 'Non renseignee'
    return `Votre participation est confirmee !

Evenement : ${event.title}
Lieu : ${event.location || 'Voir l\'application'}
Date : ${date}

A bientot sur Babi Vibes !`
}

export const sendAttendanceNotification = async (event, profile) => {
    const organizerPhone = event.organizerPhone || event.organizer_phone
    const userPhone = profile.phone

    const results = {}

    if (organizerPhone) {
        try {
            results.organizerMessage = await sendWhatsAppMessage(organizerPhone, formatAttendanceMessage(event, profile))
        } catch (err) {
            results.organizerError = err.message
        }
    }

    if (userPhone && userPhone !== organizerPhone) {
        try {
            results.userMessage = await sendWhatsAppMessage(userPhone, formatUserConfirmationMessage(event))
        } catch (err) {
            results.userError = err.message
        }
    }

    const success = !!(results.organizerMessage?.success || results.userMessage?.success)
    return { success, ...results }
}

export const sendQrImageToPhone = async (phoneNumber, qrDataUrl, caption = '') => {
    const config = getGreenApiConfig()
    if (!config.apiUrl || !config.idInstance || !config.apiToken) return { success: false }

    const cleanedPhoneNumber = cleanIvorianPhoneNumber(phoneNumber)
    const cleanPhone = cleanedPhoneNumber.replace(/[^\d]/g, '')
    const endpoint = `${config.apiUrl}/waInstance${config.idInstance}/sendFileByUpload/${config.apiToken}`

    // Convertir dataURL base64 en Blob
    const [meta, b64] = qrDataUrl.split(',')
    const mime = meta.match(/:(.*?);/)?.[1] || 'image/png'
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: mime })

    const form = new FormData()
    form.append('chatId', `${cleanPhone}@c.us`)
    form.append('caption', caption)
    form.append('file', blob, 'qr.png')

    try {
        const response = await fetch(endpoint, { method: 'POST', body: form })
        if (!response.ok) return { success: false }
        const data = await response.json()
        return { success: true, messageId: data.idMessage }
    } catch {
        return { success: false }
    }
}

export const sendWhatsAppLocation = async (phoneNumber, lat, lng, name, address) => {
    const config = getGreenApiConfig()

    if (!phoneNumber || !lat || !lng) {
        throw new Error('Phone number, latitude, and longitude are required')
    }

    if (!config.apiUrl || !config.idInstance || !config.apiToken) {
        throw new Error('GreenAPI configuration is missing. Check your .env file.')
    }

    const cleanedPhoneNumber = cleanIvorianPhoneNumber(phoneNumber)
    const cleanPhone = cleanedPhoneNumber.replace(/[^\d]/g, '')
    const endpoint = `${config.apiUrl}/waInstance${config.idInstance}/sendLocation/${config.apiToken}`

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chatId: `${cleanPhone}@c.us`,
            latitude: lat,
            longitude: lng,
            nameLocation: name || 'Localisation',
            addressLocation: address || ''
        })
    })

    if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`GreenAPI Error: ${errorData.message || response.statusText}`)
    }

    const data = await response.json()
    return {
        success: true,
        messageId: data.idMessage
    }
}
