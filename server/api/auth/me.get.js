import { readSessionUser } from '../../utils/auth'

export default defineEventHandler((event) => {
  const user = readSessionUser(event)
  return {
    ok: Boolean(user),
    user: user || null,
  }
})
