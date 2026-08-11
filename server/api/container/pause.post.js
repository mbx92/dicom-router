import {
  resolveComposeAbsolutePath,
  runDockerCompose,
} from '../../utils/docker'

export default defineEventHandler(async () => {
  try {
    const { composeFile, absolutePath } = await resolveComposeAbsolutePath()
    const result = await runDockerCompose(absolutePath, ['pause'])

    if (!result.ok) {
      throw createError({
        statusCode: 500,
        statusMessage:
          result.stderr.trim() ||
          result.stdout.trim() ||
          `docker compose pause gagal (exit ${result.exitCode})`,
        data: result,
      })
    }

    return {
      ok: true,
      action: 'pause',
      composeFile,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    }
  } catch (error) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 502,
      statusMessage: error.message || 'Gagal pause container',
    })
  }
})
