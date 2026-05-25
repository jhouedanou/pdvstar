// Pays supportés pour l'auth téléphone
export const COUNTRY_CODES = [
    { code: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire', placeholder: '0700000000' },
    { code: '+33', flag: '🇫🇷', name: 'France', placeholder: '6 12 34 56 78' },
    { code: '+221', flag: '🇸🇳', name: 'Sénégal', placeholder: '77 123 45 67' },
    { code: '+233', flag: '🇬🇭', name: 'Ghana', placeholder: '24 123 4567' },
    { code: '+229', flag: '🇧🇯', name: 'Bénin', placeholder: '90 12 34 56' },
    { code: '+228', flag: '🇹🇬', name: 'Togo', placeholder: '90 12 34 56' },
    { code: '+227', flag: '🇳🇪', name: 'Niger', placeholder: '90 12 34 56' },
    { code: '+226', flag: '🇧🇫', name: 'Burkina Faso', placeholder: '70 12 34 56' }
]

// Formatage : combine country code + local number
export const buildFullPhone = (countryCode, localNumber) => {
    const digits = (localNumber || '').replace(/\D/g, '')
    return countryCode + digits
}
