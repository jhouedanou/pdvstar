/**
 * Utilitaire d'upload d'image securise
 * - Valide le type MIME + magic bytes
 * - Limite taille (5 Mo max, warning > 2 Mo)
 * - Limite dimensions (4096x4096 max)
 * - Redimensionne a maxWidth/maxHeight (defaut 1200px)
 * - Compresse via Canvas API (JPEG quality 0.8) - supprime EXIF par effet de bord
 */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5 Mo
const WARN_SIZE = 2 * 1024 * 1024 // 2 Mo
const MAX_DIMENSION = 4096
const DEFAULT_MAX_WIDTH = 1200
const DEFAULT_MAX_HEIGHT = 1200
const COMPRESSION_QUALITY = 0.8

// Magic bytes signatures pour les types d'image courants
const MAGIC_BYTES = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': {
    offset: 8,
    bytes: [[0x57, 0x45, 0x42, 0x50]]
  }
}

/**
 * Verifie les magic bytes d'un fichier pour confirmer son type reel
 */
async function checkMagicBytes(file) {
  const buffer = await file.slice(0, 12).arrayBuffer()
  const bytes = new Uint8Array(buffer)

  for (const [mimeType, config] of Object.entries(MAGIC_BYTES)) {
    const offset = config.offset || 0
    const signatures = config.bytes || config

    for (const signature of signatures) {
      let match = true
      for (let i = 0; i < signature.length; i++) {
        if (bytes[offset + i] !== signature[i]) {
          match = false
          break
        }
      }
      if (match) return mimeType
    }
  }
  return null
}

/**
 * Charge une image et retourne ses dimensions
 */
function getImageDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.width, height: img.height, img })
    img.onerror = () => reject(new Error('Impossible de charger l\'image'))
    img.src = dataUrl
  })
}

/**
 * Compresse et redimensionne une image via Canvas
 */
function compressImage(img, maxWidth, maxHeight) {
  let { width, height } = img

  // Redimensionner proportionnellement si necessaire
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, width, height)

  return canvas.toDataURL('image/jpeg', COMPRESSION_QUALITY)
}

/**
 * Traite un fichier image avec validation et compression
 * @param {File} file - Le fichier selectionne
 * @param {Object} options - Options de traitement
 * @param {number} options.maxWidth - Largeur max (defaut 1200)
 * @param {number} options.maxHeight - Hauteur max (defaut 1200)
 * @returns {Promise<{success: boolean, data?: string, error?: string, warnings?: string[]}>}
 */
export async function processImage(file, options = {}) {
  const maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH
  const maxHeight = options.maxHeight || DEFAULT_MAX_HEIGHT
  const warnings = []

  // 1. Verifier le type MIME declare
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      error: `Type de fichier non autorise: ${file.type || 'inconnu'}. Formats acceptes: JPEG, PNG, WebP, GIF.`
    }
  }

  // 2. Verifier la taille
  if (file.size > MAX_SIZE) {
    const sizeMo = (file.size / (1024 * 1024)).toFixed(1)
    return {
      success: false,
      error: `Fichier trop volumineux (${sizeMo} Mo). Taille maximale: 5 Mo.`
    }
  }

  if (file.size > WARN_SIZE) {
    const sizeMo = (file.size / (1024 * 1024)).toFixed(1)
    warnings.push(`Image volumineuse (${sizeMo} Mo) - elle sera compressee.`)
  }

  // 3. Verifier les magic bytes (fichier deguise?)
  try {
    const detectedType = await checkMagicBytes(file)
    if (!detectedType) {
      return {
        success: false,
        error: 'Ce fichier n\'est pas une image valide (contenu non reconnu).'
      }
    }
    if (detectedType !== file.type) {
      // WebP a un header RIFF, on tolere la detection
      if (!(file.type === 'image/webp' && detectedType === 'image/webp')) {
        return {
          success: false,
          error: `Le fichier pretend etre ${file.type} mais contient du ${detectedType}. Upload refuse.`
        }
      }
    }
  } catch {
    // Si on ne peut pas lire les magic bytes, on continue avec le type declare
    warnings.push('Verification des magic bytes impossible - type MIME utilise.')
  }

  // 4. Lire le fichier en dataURL
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'))
    reader.readAsDataURL(file)
  })

  // 5. Charger l'image et verifier les dimensions
  let imgData
  try {
    imgData = await getImageDimensions(dataUrl)
  } catch {
    return {
      success: false,
      error: 'Impossible de charger l\'image. Le fichier est peut-etre corrompu.'
    }
  }

  if (imgData.width > MAX_DIMENSION || imgData.height > MAX_DIMENSION) {
    return {
      success: false,
      error: `Image trop grande (${imgData.width}x${imgData.height}). Dimensions maximales: ${MAX_DIMENSION}x${MAX_DIMENSION}.`
    }
  }

  // 6. Compresser et redimensionner
  try {
    const compressed = compressImage(imgData.img, maxWidth, maxHeight)
    if (imgData.width > maxWidth || imgData.height > maxHeight) {
      warnings.push(`Image redimensionnee de ${imgData.width}x${imgData.height} a ${Math.min(imgData.width, maxWidth)}x${Math.min(imgData.height, maxHeight)}.`)
    }

    return {
      success: true,
      data: compressed,
      warnings: warnings.length > 0 ? warnings : undefined
    }
  } catch {
    return {
      success: false,
      error: 'Erreur lors de la compression de l\'image.'
    }
  }
}
