const ENVIRONMENTS = {
  sandbox: {
    id: 'sandbox',
    label: 'Sandbox',
    baseUrl: 'https://api-satusehat-stg.dto.kemkes.go.id',
  },
  production: {
    id: 'production',
    label: 'Production',
    baseUrl: 'https://api-satusehat.kemkes.go.id',
  },
}

export function resolveEnvironment(environment) {
  const key = String(environment || 'sandbox').toLowerCase()
  return ENVIRONMENTS[key] || null
}

export async function getAccessToken({ baseUrl, clientId, clientSecret }) {
  const url = `${baseUrl}/oauth2/v1/accesstoken?grant_type=client_credentials`

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      data?.issue?.[0]?.details?.text ||
      data?.error_description ||
      data?.error ||
      `Gagal mendapatkan token (HTTP ${response.status})`

    const error = new Error(message)
    error.statusCode = response.status
    error.data = data
    throw error
  }

  if (!data?.access_token) {
    const error = new Error('Response token tidak berisi access_token')
    error.statusCode = 502
    throw error
  }

  return data.access_token
}

export async function downloadDockerCompose({ baseUrl, accessToken }) {
  const url = `${baseUrl}/dicom-router`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/zip, application/octet-stream, */*',
    },
  })

  if (!response.ok) {
    let detail = `Gagal mengunduh docker-compose (HTTP ${response.status})`

    try {
      const payload = await response.json()
      detail =
        payload?.issue?.[0]?.details?.text ||
        payload?.message ||
        detail
    } catch {
      // keep default message
    }

    const error = new Error(detail)
    error.statusCode = response.status
    throw error
  }

  const arrayBuffer = await response.arrayBuffer()
  const contentType =
    response.headers.get('content-type') || 'application/zip'

  let filename = 'docker-compose.zip'
  const disposition = response.headers.get('content-disposition')
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i)
    if (match?.[1]) {
      filename = decodeURIComponent(match[1].replace(/"/g, '').trim())
    }
  }

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
    filename,
  }
}
