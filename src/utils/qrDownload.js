// Téléchargement QR : image PNG direct OU PDF via print dialog (sans dépendance)

const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]))

/**
 * Télécharge le QR en PNG.
 */
export const downloadQrAsImage = async (dataUrl, filename = 'qr-code') => {
    if (!dataUrl) return false
    let href = dataUrl
    if (!dataUrl.startsWith('data:')) {
        try {
            const res = await fetch(dataUrl)
            const blob = await res.blob()
            href = URL.createObjectURL(blob)
        } catch {
            return false
        }
    }
    const a = document.createElement('a')
    a.href = href
    a.download = `${filename}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    if (href !== dataUrl) setTimeout(() => URL.revokeObjectURL(href), 1000)
    return true
}

/**
 * Génère un PDF imprimable via nouvelle fenêtre (utilise dialog "Imprimer / Enregistrer en PDF").
 * N'utilise pas document.write — passe par Blob URL pour éviter XSS.
 */
export const downloadQrAsPdf = (opts) => {
    const { qrDataUrl, eventTitle = 'Événement', eventDate = '', location = '', pseudo = '', phone = '', type = 'RSVP' } = opts
    if (!qrDataUrl) return false

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Babi Vibes — ${escapeHtml(eventTitle)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fff; color: #111; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
  .header { text-align: center; margin-bottom: 30px; }
  .brand { font-size: 28px; font-weight: 900; color: #f5b800; margin: 0; }
  .tagline { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
  .type-badge { display: inline-block; background: #f5b800; color: #000; font-weight: 700; font-size: 11px; padding: 4px 12px; border-radius: 999px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
  .event-title { font-size: 22px; font-weight: 800; margin: 0 0 8px; text-align: center; }
  .event-meta { text-align: center; color: #555; font-size: 13px; line-height: 1.6; margin-bottom: 24px; }
  .qr-box { background: #fff; border: 2px solid #eee; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
  .qr-box img { display: block; width: 280px; height: 280px; }
  .participant { background: #f7f7f7; border-radius: 8px; padding: 12px 18px; text-align: center; margin-bottom: 24px; min-width: 280px; }
  .participant strong { font-size: 16px; }
  .participant small { display: block; color: #666; font-size: 12px; margin-top: 4px; }
  .footer { font-size: 10px; color: #999; text-align: center; max-width: 320px; line-height: 1.5; }
  .actions { margin-top: 30px; display: flex; gap: 10px; }
  button { background: #f5b800; color: #000; border: none; padding: 10px 24px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; }
  button.secondary { background: #eee; color: #333; }
  @media print { .actions { display: none; } body { padding: 30px; } }
</style>
</head>
<body>
  <div class="header">
    <h1 class="brand">BABI VIBES</h1>
    <div class="tagline">Billet d'accès</div>
  </div>
  <div class="type-badge">${escapeHtml(type)}</div>
  <h2 class="event-title">${escapeHtml(eventTitle)}</h2>
  <div class="event-meta">
    ${eventDate ? `<div>📅 ${escapeHtml(eventDate)}</div>` : ''}
    ${location ? `<div>📍 ${escapeHtml(location)}</div>` : ''}
  </div>
  <div class="qr-box"><img src="${qrDataUrl}" alt="QR code"></div>
  ${pseudo || phone ? `<div class="participant"><strong>${escapeHtml(pseudo || 'Participant')}</strong>${phone ? `<small>${escapeHtml(phone)}</small>` : ''}</div>` : ''}
  <p class="footer">Présentez ce QR code à l'entrée. Code unique, à usage strictement personnel.</p>
  <div class="actions">
    <button id="btn-print">Enregistrer en PDF</button>
    <button class="secondary" id="btn-close">Fermer</button>
  </div>
  <script>
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-close').addEventListener('click', () => window.close());
  </script>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'width=600,height=800')
    if (!win) {
        URL.revokeObjectURL(url)
        return false
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    return true
}
