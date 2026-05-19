/**
 * GreenAPI service for WhatsApp messages.
 */

const getGreenApiConfig = () => ({
    apiUrl: import.meta.env.VITE_GREEN_API_URL,
    idInstance: import.meta.env.VITE_GREEN_ID_INSTANCE,
    apiToken: import.meta.env.VITE_GREEN_API_TOKEN
})

const cleanIvorianPhoneNumber = (phoneNumber) => {
    const ivorianRegex = /^(\+225)\d{2}(\d+)$/
    const match = phoneNumber.match(ivorianRegex)
    if (match) return `${match[1]}${match[2]}`
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

export const sendAttendanceNotification = async (event, profile) => {
    const organizerPhone = event.organizerPhone || event.organizer_phone
    if (!organizerPhone) {
        return { success: false, skipped: true, reason: 'organizer_phone_missing' }
    }

    const organizerMessage = await sendWhatsAppMessage(organizerPhone, formatAttendanceMessage(event, profile))
    return {
        success: true,
        organizerMessage
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
