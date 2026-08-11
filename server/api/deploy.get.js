import {
  parseComposePsJson,
  resolveComposeAbsolutePath,
  runDockerCompose,
} from '../utils/docker'

export default defineEventHandler(async () => {
  try {
    const { composeFile, absolutePath } = await resolveComposeAbsolutePath()
    const result = await runDockerCompose(absolutePath, [
      'ps',
      '-a',
      '--format',
      'json',
    ])

    return {
      ok: result.ok,
      composeFile,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      services: parseComposePsJson(result.stdout),
    }
  } catch (error) {
    if (error.statusCode) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message,
      })
    }
    throw createError({
      statusCode: 502,
      statusMessage: error.message || 'Gagal membaca status deploy',
    })
  }
})
