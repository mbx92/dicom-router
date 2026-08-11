import {
  resolveComposeAbsolutePath,
  runDockerCompose,
} from '../../utils/docker'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const tail = Math.min(
    200,
    Math.max(1, Number.parseInt(String(query.tail || '50'), 10) || 50),
  )

  try {
    const { composeFile, absolutePath } = await resolveComposeAbsolutePath()
    const result = await runDockerCompose(absolutePath, [
      'logs',
      '--tail',
      String(tail),
      '--no-color',
    ])

    // docker compose logs often writes to stderr even on success
    const logs = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()

    if (!result.ok && !logs) {
      throw createError({
        statusCode: 500,
        statusMessage: `Gagal mengambil logs (exit ${result.exitCode})`,
        data: result,
      })
    }

    return {
      ok: true,
      composeFile,
      tail,
      logs,
      exitCode: result.exitCode,
    }
  } catch (error) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 502,
      statusMessage: error.message || 'Gagal mengambil docker logs',
    })
  }
})
