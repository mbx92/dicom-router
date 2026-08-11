// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  typescript: {
    typeCheck: false,
    shim: false,
  },
  css: ['~/assets/css/main.css'],
  routeRules: {
    '/compose/**': { prerender: false, index: false },
  },
  nitro: {
    externals: {
      external: ['better-sqlite3'],
    },
  },
  app: {
    head: {
      title: 'DICOM Router — SATUSEHAT Downloader',
      meta: [
        {
          name: 'description',
          content:
            'Ambil, edit, dan deploy docker-compose DICOM Router SATUSEHAT tanpa Postman.',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap',
        },
      ],
    },
  },
})
