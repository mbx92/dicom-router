import { spawn } from 'node:child_process'
import { dirname } from 'node:path'
import {
  getComposeAbsolutePath,
  resolveComposeFileName,
} from './compose-fs'

/**
 * Run `docker compose` with the given args against a compose file.
 * cwd is the compose file directory so relative volumes (./router.conf) resolve.
 * @param {string} composeFilePath Absolute path to compose YAML
 * @param {string[]} args e.g. ['up', '-d', '--pull', 'always']
 */
export function runDockerCompose(composeFilePath, args) {
  return new Promise((resolvePromise) => {
    const child = spawn(
      'docker',
      ['compose', '-f', composeFilePath, ...args],
      {
        env: process.env,
        cwd: dirname(composeFilePath),
      },
    )

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => {
      resolvePromise({
        ok: false,
        exitCode: 1,
        stdout,
        stderr:
          stderr ||
          error.message ||
          'Gagal menjalankan docker. Pastikan Docker CLI terpasang dan socket dapat diakses.',
      })
    })

    child.on('close', (code) => {
      resolvePromise({
        ok: code === 0,
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })
  })
}

export async function resolveComposeAbsolutePath() {
  const composeFile = await resolveComposeFileName()
  if (!composeFile) {
    const error = new Error('Belum ada file compose.')
    error.statusCode = 404
    throw error
  }
  const absolutePath = await getComposeAbsolutePath(composeFile)
  return { composeFile, absolutePath }
}

export function parseComposePsJson(stdout) {
  const raw = (stdout || '').trim()
  if (!raw) return []

  try {
    if (raw.startsWith('[')) {
      return JSON.parse(raw)
    }
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
  } catch {
    return []
  }
}
