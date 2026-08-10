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

    setResponseHeaders(event, {
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
    })

    return file.buffer
  } catch (error) {
    throw createError({
      statusCode: error.statusCode || 502,
      statusMessage: error.message || 'Gagal mengunduh docker-compose',
    })
  }
})
