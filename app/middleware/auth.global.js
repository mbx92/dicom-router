export default defineNuxtRouteMiddleware(async (to) => {
  let user = null

  try {
    // On client, do NOT use useRequestFetch() — it can reuse the initial
    // SSR request headers (without the new session cookie) and loop back to /login.
    const me = import.meta.server
      ? await useRequestFetch()('/api/auth/me')
      : await $fetch('/api/auth/me', { credentials: 'include' })
    user = me?.user || null
  } catch {
    user = null
  }

  if (to.path === '/login') {
    if (user) {
      return navigateTo('/')
    }
    return
  }

  if (!user) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
