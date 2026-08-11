import { readSessionUser } from '../utils/auth'

/**
 * Protect API routes. Auth endpoints stay public.
 * Static assets and page HTML are handled by Nuxt route middleware.
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (!path.startsWith('/api/')) return
  if (path.startsWith('/api/auth/')) return

  const user = readSessionUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized — silakan login',
    })
  }

  event.context.user = user
})
