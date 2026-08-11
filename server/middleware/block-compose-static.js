/**
 * Prevent serving compose artifacts (may contain secrets) as static files.
 * Files under public/compose are only accessible via /api/* handlers.
 */
export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  if (path === '/compose' || path.startsWith('/compose/')) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
    })
  }
})
