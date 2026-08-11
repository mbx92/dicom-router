import {
  getComposeAbsolutePath,
  resolveComposeFileName,
} from '../utils/compose-fs'
import { runDockerCompose } from '../utils/docker'

export default defineEventHandler(async () => {
  try {
    const composeFile = await resolveComposeFileName()
    if (!composeFile) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Belum ada file compose. Ambil dan simpan compose dulu.',
      })
    }

    const absolutePath = await getComposeAbsolutePath(composeFile)
    const result = await runDockerCompose(absolutePath, [
      'up',
      '-d',
      '--pull',
      'always',
    ])

    if (!result.ok) {
      throw createError({
        statusCode: 500,
        statusMessage:
          result.stderr.trim() ||
          result.stdout.trim() ||
          `docker compose gagal (exit ${result.exitCode})`,
        data: result,
      })
    }

    return {
      ok: true,
      composeFile,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
    }
  } catch (error) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 502,
      statusMessage: error.message || 'Gagal deploy compose',
    })
  }
})
