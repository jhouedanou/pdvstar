export const SESSION_KEYS = {
    user: 'pdvstar_session_user',
    admin: 'pdvstar_admin_session'
}

export const DAY_IN_MS = 24 * 60 * 60 * 1000
export const USER_SESSION_DURATION_MS = 90 * DAY_IN_MS
export const ADMIN_SESSION_DURATION_MS = 30 * DAY_IN_MS

const getStorage = () => {
    if (typeof window === 'undefined') return null
    try {
        return window.localStorage
    } catch {
        return null
    }
}

export const readSession = (key) => {
    const storage = getStorage()
    if (!storage) return null

    const stored = storage.getItem(key)
    if (!stored) return null

    try {
        const session = JSON.parse(stored)
        if (!session?.user || !session.expiry || Date.now() > session.expiry) {
            storage.removeItem(key)
            return null
        }
        return session
    } catch {
        storage.removeItem(key)
        return null
    }
}

export const writeSession = (key, user, durationMs) => {
    const storage = getStorage()
    if (!storage || !user) return null

    const session = {
        user,
        expiry: Date.now() + durationMs
    }
    try {
        storage.setItem(key, JSON.stringify(session))
        return session
    } catch {
        return null
    }
}

export const clearSession = (key) => {
    const storage = getStorage()
    if (storage) storage.removeItem(key)
}
