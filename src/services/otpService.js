import { sendWhatsAppMessage } from './greenApiService'

const OTP_TTL_MS = 5 * 60 * 1000 // 5 minutes

const storageKey = (phone) => `otp_${phone.replace(/\D/g, '')}`

export const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000))

export const sendOtp = async (phone) => {
    const code = generateOtp()
    const expiry = Date.now() + OTP_TTL_MS

    localStorage.setItem(storageKey(phone), JSON.stringify({ code, expiry }))

    const message = `Votre code de verification Babi Vibes : *${code}*\n\nValable 5 minutes. Ne le partagez pas.`
    await sendWhatsAppMessage(phone, message)

    return { sent: true }
}

export const verifyOtp = (phone, inputCode) => {
    const key = storageKey(phone)
    const raw = localStorage.getItem(key)
    if (!raw) return { valid: false, reason: 'no_otp' }

    let stored
    try { stored = JSON.parse(raw) } catch { return { valid: false, reason: 'parse_error' } }

    if (Date.now() > stored.expiry) {
        localStorage.removeItem(key)
        return { valid: false, reason: 'expired' }
    }

    if (stored.code !== inputCode.trim()) {
        return { valid: false, reason: 'wrong_code' }
    }

    localStorage.removeItem(key)
    return { valid: true }
}
