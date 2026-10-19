const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const STANDARD_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

export async function prepareImagePhoto(file, {square=false, sizes=[1200,960,720,560,400], maxLength=220000, allowHeic=false}={}) {
  const types = allowHeic ? [...STANDARD_TYPES, 'image/heic', 'image/heif'] : STANDARD_TYPES
  const extensions = allowHeic ? /\.(jpe?g|png|webp|heic|heif)$/i : /\.(jpe?g|png|webp)$/i
  if (!(types.includes(file.type) || (!file.type && extensions.test(file.name))) || file.size > MAX_SOURCE_BYTES) {
    throw new Error(`Choose a JPG, PNG, or WebP${allowHeic ? ', or HEIC' : ''} photo up to 12 MB.`)
  }

  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try { await image.decode() } catch { throw new Error('This photo could not be opened. Try a JPG, PNG, or WebP image.') }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('This photo could not be opened.')

    const side = Math.min(image.naturalWidth, image.naturalHeight)
    for (const size of sizes) {
      const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = square ? size : Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = square ? size : Math.max(1, Math.round(image.naturalHeight * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Photo editing is unavailable in this browser.')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      if (square) context.drawImage(image, (image.naturalWidth-side)/2, (image.naturalHeight-side)/2, side, side, 0, 0, size, size)
      else context.drawImage(image, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.82, 0.7, 0.55, 0.4, 0.3]) {
        const result = canvas.toDataURL('image/jpeg', quality)
        if (result.startsWith('data:image/jpeg;base64,') && result.length <= maxLength) return result
      }
    }
    throw new Error('This photo could not be compressed enough to save. Try a different image.')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const prepareProfilePhoto = file => prepareImagePhoto(file, {square:true, sizes:[320,256,192,160], allowHeic:true})
