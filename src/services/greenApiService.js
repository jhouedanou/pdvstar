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

    // Remove '+' and any spaces from phone number for API
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '')

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
 * Format event notification message
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
