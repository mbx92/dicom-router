import {
  clearComposeDir,
  listComposeFiles,
  saveZip,
  unzipCompose,
} from '../utils/compose-fs'
import {
  downloadDockerCompose,
  getAccessToken,
  resolveEnvironment,
} from '../utils/satusehat'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const environment = resolveEnvironment(body?.environment)
  const clientId = String(body?.clientId || '').trim()
  const clientSecret = String(body?.clientSecret || '').trim()
  const mode = String(body?.mode || getQuery(event)?.mode || 'disk').toLowerCase()

  if (!environment) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Environment harus sandbox atau production',
    })
  }

  if (!clientId || !clientSecret) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Client ID dan Client Secret wajib diisi',
    })
  }

  try {
    const accessToken = await getAccessToken({
      baseUrl: environment.baseUrl,
      clientId,
      clientSecret,
    })

    const file = await downloadDockerCompose({
      baseUrl: environment.baseUrl,
      accessToken,
    })

    if (mode === 'browser') {
      setResponseHeaders(event, {
        'Content-Type': file.contentType,
        'Content-Disposition': `attachment; filename="${file.filename}"`,
        'Cache-Control': 'no-store',
      })
      return file.buffer
    }

    await clearComposeDir()
    await saveZip(file.buffer)
    const extracted = await unzipCompose()
    const files = extracted.files.length
      ? extracted.files
      : await listComposeFiles()

    return {
      ok: true,
      composeFile: extracted.composeFile,
      routerConfFile: extracted.routerConfFile,
      files,
      filename: file.filename,
    }
  } catch (error) {
    throw createError({
      statusCode: error.statusCode || 502,
      statusMessage: error.message || 'Gagal mengunduh docker-compose',
    })
  }
})
