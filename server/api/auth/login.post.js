import { authenticateUser, createSession } from '../../utils/auth-db'
import { setSessionCookie } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = String(body?.username || '').trim()
  const password = String(body?.password || '')

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username dan password wajib diisi',
    })
  }

  const user = authenticateUser(username, password)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Username atau password salah',
    })
  }

  const session = createSession(user.id)
  setSessionCookie(event, session)

  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
    },
  }
})
