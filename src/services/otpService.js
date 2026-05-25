import { sendWhatsAppMessage } from './greenApiService'
import { sendEmail, formatOtpEmail } from './resendService'

const OTP_TTL_MS = 5 * 60 * 1000

const storageKey = (id) => `otp_${String(id).toLowerCase().replace(/[^a-z0-9@._+-]/g, '')}`

export const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000))

// Envoi OTP via WhatsApp (téléphone)
export const sendOtp = async (phone) => {
    const code = generateOtp()
    const expiry = Date.now() + OTP_TTL_MS
    localStorage.setItem(storageKey(phone), JSON.stringify({ code, expiry, channel: 'whatsapp' }))
    const message = `Votre code de verification Babi Vibes : *${code}*\n\nValable 5 minutes. Ne le partagez pas.`
    await sendWhatsAppMessage(phone, message)
    return { sent: true, channel: 'whatsapp' }
}

// Envoi OTP via email (Resend)
export const sendOtpEmail = async (email, recipientName = '') => {
    const code = generateOtp()
    const expiry = Date.now() + OTP_TTL_MS
    localStorage.setItem(storageKey(email), JSON.stringify({ code, expiry, channel: 'email' }))
    const html = formatOtpEmail(code, recipientName)
    await sendEmail(email, `Code de vérification : ${code}`, html)
    return { sent: true, channel: 'email' }
}

export const verifyOtp = (identifier, inputCode) => {
    const key = storageKey(identifier)
    const raw = localStorage.getItem(key)
    if (!raw) return { valid: false, reason: 'no_otp' }

    let stored
    try { stored = JSON.parse(raw) } catch { return { valid: false, reason: 'parse_error' } }

    if (Date.now() > stored.expiry) {
        localStorage.removeItem(key)
        return { valid: false, reason: 'expired' }
    }
    if (stored.code !== inputCode.trim()) return { valid: false, reason: 'wrong_code' }

    localStorage.removeItem(key)
    return { valid: true }
}
