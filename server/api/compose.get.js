import { readEditableConfig } from '../utils/compose-fs'

export default defineEventHandler(async () => {
  try {
    const result = await readEditableConfig()
    return {
      ok: true,
      composeFile: result.composeFile,
      composeContent: result.composeContent,
      // backward-compatible alias
      content: result.composeContent,
      routerConfFile: result.routerConfFile,
      routerConfContent: result.routerConfContent,
      files: result.files,
    }
  } catch (error) {
    throw createError({
      statusCode: error.statusCode || 502,
      statusMessage: error.message || 'Gagal membaca file konfigurasi',
    })
  }
})
