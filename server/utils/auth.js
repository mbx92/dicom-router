import {
  SESSION_COOKIE,
  deleteSession,
  getSessionUser,
  purgeExpiredSessions,
} from './auth-db'

export function readSessionUser(event) {
  purgeExpiredSessions()
  const sessionId = getCookie(event, SESSION_COOKIE)
  return getSessionUser(sessionId)
}

export function requireUser(event) {
  const user = readSessionUser(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
  event.context.user = user
  return user
}

function cookieSecure() {
  // Default false for LAN HTTP deploys. Enable only behind HTTPS.
  return String(process.env.AUTH_COOKIE_SECURE || '').toLowerCase() === 'true'
}

export function setSessionCookie(event, session) {
  setCookie(event, SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    maxAge: session.maxAge,
  })
}

export function clearSessionCookie(event) {
  const sessionId = getCookie(event, SESSION_COOKIE)
  deleteSession(sessionId)
  deleteCookie(event, SESSION_COOKIE, {
    path: '/',
    secure: cookieSecure(),
    sameSite: 'lax',
  })
}
