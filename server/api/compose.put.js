import { writeEditableConfig } from '../utils/compose-fs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const composeFile = body?.composeFile
    ? String(body.composeFile).trim()
    : undefined
  const routerConfFile = body?.routerConfFile
    ? String(body.routerConfFile).trim()
    : undefined

  // Support both new fields and legacy `content`
  const composeContent =
    body?.composeContent !== undefined
      ? body.composeContent
      : body?.content
  const routerConfContent = body?.routerConfContent

  if (
    (composeContent === undefined || composeContent === null) &&
    (routerConfContent === undefined || routerConfContent === null)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Kirim composeContent dan/atau routerConfContent',
    })
  }

  try {
    const result = await writeEditableConfig({
      composeFile,
      composeContent,
      routerConfFile,
      routerConfContent,
    })

    return {
      ok: true,
      composeFile: result.composeFile,
      composeContent: result.composeContent,
      content: result.composeContent,
      routerConfFile: result.routerConfFile,
      routerConfContent: result.routerConfContent,
    }
  } catch (error) {
    throw createError({
      statusCode: error.statusCode || 502,
      statusMessage: error.message || 'Gagal menyimpan file konfigurasi',
    })
  }
})
