/**
 * GreenAPI Service for WhatsApp Integration
 * Handles sending WhatsApp messages via GreenAPI
 */

const getGreenApiConfig = () => {
    return {
        apiUrl: import.meta.env.VITE_GREEN_API_URL,
        idInstance: import.meta.env.VITE_GREEN_ID_INSTANCE,
        apiToken: import.meta.env.VITE_GREEN_API_TOKEN
    }
}

/**
 * Clean Ivorian phone number by removing leading 07 after country code
 * Example: +22507XXXXXXXX becomes +225XXXXXXXX
 * @param {string} phoneNumber - Phone number to clean
 * @returns {string} Cleaned phone number
 */
const cleanIvorianPhoneNumber = (phoneNumber) => {
    // Remove the first 2 digits after +225 (e.g. +2250748... -> +22548...)
    // This effectively converts new 10-digit format to old 8-digit format if that's what's intended
    const ivorianRegex = /^(\+225)\d{2}(\d+)$/
    const match = phoneNumber.match(ivorianRegex)
    if (match) {
        return `${match[1]}${match[2]}`
    }
    return phoneNumber
}

/**
 * Send a WhatsApp message via GreenAPI
 * @param {string} phoneNumber - Recipient phone number (with country code, e.g., +22545029721)
 * @param {string} message - Message text to send
 * @returns {Promise<Object>} API response
 */
export const sendWhatsAppMessage = async (phoneNumber, message) => {
    const config = getGreenApiConfig()

    // Validate configuration
    if (!config.apiUrl || !config.idInstance || !config.apiToken) {
        throw new Error('GreenAPI configuration is missing. Check your .env file.')
    }

    // Validate phone number format
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
        throw new Error('Phone number must be in international format (e.g., +22545029721)')
    }

    // Clean Ivorian phone numbers (remove 0 after +225)
    const cleanedPhoneNumber = cleanIvorianPhoneNumber(phoneNumber)

    // Remove '+' and any spaces from phone number for API
    const cleanPhone = cleanedPhoneNumber.replace(/[^\d]/g, '')

    try {
        const endpoint = `${config.apiUrl}/waInstance${config.idInstance}/sendMessage/${config.apiToken}`

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chatId: `${cleanPhone}@c.us`,
                message: message
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
    } catch (error) {
        console.error('WhatsApp message sending failed:', error)
        throw error
    }
}

/**
 * Send event notification to organizer and user
 * @param {Object} event - Event object
 * @param {string} userName - User name
 * @param {string} userPhone - User phone
 * @returns {Promise<Object>} Result of both messages
 */
export const sendEventNotification = async (event, userName, userPhone) => {
    const organizerMessage = `🎉 Nouvel inscrit pour l'événement "${event.title}"
📍 Lieu: ${event.location}
👤 Nom: ${userName}
📱 Téléphone: ${userPhone}
⏰ ${new Date().toLocaleString('fr-FR')}`

    const userConfirmationMessage = `✅ Confirmation d'inscription

🎉 Événement: "${event.title}"
📍 Lieu: ${event.location}
📅 Date: ${new Date(event.date).toLocaleDateString('fr-FR')}
👤 Organisateur: ${event.organizer}

Vous recevrez plus d'informations prochainement. À bientôt! 🎊`

    try {
        // Send to organizer (using user's phone as organizer for now)
        const organizerResult = await sendWhatsAppMessage(userPhone, organizerMessage)

        // Send confirmation to user
        const userResult = await sendWhatsAppMessage(userPhone, userConfirmationMessage)

        return {
            success: true,
            organizerMessage: organizerResult,
            userMessage: userResult
        }
    } catch (error) {
        throw error
    }
}

/**
 * Format event notification message (legacy function, kept for compatibility)
 * @param {Object} event - Event object
 * @param {string} userName - User name
 * @param {string} userPhone - User phone
 * @returns {string} Formatted message
 */
export const formatEventNotificationMessage = (event, userName, userPhone) => {
    return `🎉 Nouvel inscrit pour l'événement "${event.title}"
📍 Lieu: ${event.location}
👤 Nom: ${userName}
📱 Téléphone: ${userPhone}
⏰ ${new Date().toLocaleString('fr-FR')}`
}
/**
 * Send location via GreenAPI
 * @param {string} phoneNumber - Recipient phone number
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} name - Name of location
 * @param {string} address - Address of location
 * @returns {Promise<Object>} API response
 */
export const sendWhatsAppLocation = async (phoneNumber, lat, lng, name, address) => {
    const config = getGreenApiConfig()

    // Validate inputs
    if (!phoneNumber || !lat || !lng) {
        throw new Error('Phone number, latitude, and longitude are required')
    }

    // Clean phone number
    const cleanedPhoneNumber = cleanIvorianPhoneNumber(phoneNumber)
    const cleanPhone = cleanedPhoneNumber.replace(/[^\d]/g, '')

    try {
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
    } catch (error) {
        console.error('WhatsApp location sending failed:', error)
        throw error
    }
}
