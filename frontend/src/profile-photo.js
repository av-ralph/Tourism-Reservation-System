const MAX_SOURCE_BYTES = 8 * 1024 * 1024
const MAX_DATA_URL_LENGTH = 220000
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])

export async function prepareProfilePhoto(file) {
  const supported = SUPPORTED_TYPES.has(file.type) || (!file.type && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))
  if (!supported || file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose a JPG, PNG, WebP, or HEIC photo up to 8 MB.')
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try { await image.decode() } catch { throw new Error('This photo could not be opened. Try a JPG, PNG, or WebP image.') }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('This photo could not be opened.')

    const side = Math.min(image.naturalWidth, image.naturalHeight)
    for (const size of [320, 256, 192]) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Photo editing is unavailable in this browser.')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, size, size)
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, size, size)
      for (const quality of [0.82, 0.7, 0.55]) {
        const result = canvas.toDataURL('image/jpeg', quality)
        if (result.startsWith('data:image/jpeg;base64,') && result.length <= MAX_DATA_URL_LENGTH) return result
      }
    }
    throw new Error('This photo is too detailed to save. Try a different image.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
