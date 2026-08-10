// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  typescript: {
    typeCheck: false,
    shim: false,
  },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'DICOM Router — SATUSEHAT Downloader',
      meta: [
        {
          name: 'description',
          content:
            'Download docker-compose.zip terbaru untuk DICOM Router SATUSEHAT tanpa Postman.',
        },
      ],
      link: [
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
