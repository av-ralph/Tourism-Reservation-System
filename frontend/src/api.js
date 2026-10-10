const backendOrigin = (import.meta.env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '')
export const API_CONFIGURED = !import.meta.env?.PROD || !!backendOrigin

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function requestJson(url, options) {
  if (!API_CONFIGURED) {
    throw new ApiError('Online booking is not connected yet. Please contact the HM laboratory office for assistance.')
  }
  let response
  let body
  try {
    response = await fetch(backendOrigin + url, options)
    body = await response.text()
  } catch {
    throw new ApiError('The reservation service cannot be reached. Please try again shortly.')
  }

  let result
  if (body.trim()) {
    try { result = JSON.parse(body) } catch { /* Report a readable error below. */ }
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new ApiError('The reservation service is temporarily unavailable. Please try again shortly.', response.status)
    }
    const message = Array.isArray(result?.message) ? result.message.join(' ') : result?.message
    throw new ApiError(typeof message === 'string' && message ? message : response.status === 401
      ? 'Please sign in again with your administrator access key.'
      : 'Your request could not be completed. Please try again.', response.status)
  }
  if (response.status === 204) return null
  if (!result || typeof result !== 'object') {
    throw new ApiError('The reservation service returned an incomplete response. Please try again.', response.status)
  }
  return result
}

export function facilityPhotoUrl(photo){return photo?.startsWith('/api/')?backendOrigin+photo:photo}
