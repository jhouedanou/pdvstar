// Resend email service — appel API depuis client.
// SECURITY: VITE_RESEND_API_KEY est exposée au navigateur (Vite préfixe VITE_ = public).
// Pour production sécurisée, déplacer vers une edge function Supabase qui appelle Resend côté serveur.

const getResendConfig = () => ({
    apiKey: import.meta.env.VITE_RESEND_API_KEY,
    fromEmail: import.meta.env.VITE_RESEND_FROM_EMAIL || 'Babi Vibes <noreply@babivibes.com>',
    fromName: import.meta.env.VITE_RESEND_FROM_NAME || 'Babi Vibes'
})

export const sendEmail = async (to, subject, html, text = '') => {
    const config = getResendConfig()
    if (!config.apiKey) throw new Error('Resend API key absente (VITE_RESEND_API_KEY)')

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: config.fromEmail,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text: text || stripHtml(html)
        })
    })

    if (!response.ok) {
        let msg = response.statusText
        try { const err = await response.json(); msg = err.message || err.error || msg } catch {}
        throw new Error(`Resend Error: ${msg}`)
    }

    return await response.json()
}

const stripHtml = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

export const formatOtpEmail = (code, recipientName = '') => {
    const greeting = recipientName ? `Bonjour ${recipientName},` : 'Bonjour,'
    const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f5f5;padding:40px 20px;margin:0;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.05);">
<div style="text-align:center;margin-bottom:24px;">
<h1 style="color:#f5b800;font-size:24px;font-weight:900;letter-spacing:-0.5px;margin:0;">BABI VIBES</h1>
<p style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:4px 0 0;">Code de vérification</p>
</div>
<p style="color:#333;font-size:15px;line-height:1.6;">${greeting}</p>
<p style="color:#666;font-size:14px;line-height:1.6;">Voici votre code de vérification pour vous connecter à Babi Vibes :</p>
<div style="background:#f5b800;color:#000;font-size:36px;font-weight:900;letter-spacing:8px;text-align:center;padding:20px;border-radius:12px;margin:24px 0;font-family:monospace;">${code}</div>
<p style="color:#888;font-size:13px;line-height:1.6;">Ce code est valable <strong>5 minutes</strong>. Ne le partagez avec personne.</p>
<p style="color:#aaa;font-size:11px;line-height:1.6;margin-top:32px;border-top:1px solid #eee;padding-top:16px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
</div>
<p style="color:#999;font-size:11px;text-align:center;margin-top:20px;">© Babi Vibes — Plateforme d'événements Côte d'Ivoire</p>
</body></html>`
    return html
}
