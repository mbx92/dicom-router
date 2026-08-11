import { mkdir, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import AdmZip from 'adm-zip'

const COMPOSE_CANDIDATES = [
  'docker-compose.yml',
  'docker-compose.yaml',
  'compose.yml',
  'compose.yaml',
]

const ROUTER_CONF_CANDIDATES = ['router.conf']

function composeDirPath() {
  return join(process.cwd(), 'public', 'compose')
}

function zipFilePath() {
  return join(composeDirPath(), 'docker-compose.zip')
}

function fsError(statusCode, statusMessage) {
  const error = new Error(statusMessage)
  error.statusCode = statusCode
  return error
}

export function getComposeDir() {
  return composeDirPath()
}

export function getZipPath() {
  return zipFilePath()
}

export async function ensureComposeDir() {
  const composeDir = composeDirPath()
  await mkdir(composeDir, { recursive: true })
  return composeDir
}

export async function clearComposeDir() {
  const composeDir = composeDirPath()
  await rm(composeDir, { recursive: true, force: true })
  await ensureComposeDir()
}

export async function saveZip(buffer) {
  await ensureComposeDir()
  const zipPath = zipFilePath()
  await writeFile(zipPath, buffer)
  return zipPath
}

function isInsideComposeDir(filePath) {
  const composeDir = composeDirPath()
  const resolved = resolve(filePath)
  return resolved === composeDir || resolved.startsWith(composeDir + sep)
}

export async function unzipCompose() {
  const composeDir = await ensureComposeDir()
  const zipPath = zipFilePath()

  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()

  for (const entry of entries) {
    const targetPath = resolve(composeDir, entry.entryName)
    if (!isInsideComposeDir(targetPath)) {
      throw fsError(400, `Zip entry di luar folder compose: ${entry.entryName}`)
    }
  }

  zip.extractAllTo(composeDir, true)

  return readEditableConfig()
}

async function walkFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(fullPath, base)))
      continue
    }
    if (entry.isFile()) {
      files.push(relative(base, fullPath).split(sep).join('/'))
    }
  }

  return files.sort()
}

export async function listComposeFiles() {
  const composeDir = composeDirPath()
  try {
    await stat(composeDir)
  } catch {
    return []
  }
  return walkFiles(composeDir)
}

function findCandidate(list, candidates) {
  for (const candidate of candidates) {
    const match = list.find(
      (file) => file === candidate || file.endsWith(`/${candidate}`),
    )
    if (match) return match
  }
  return null
}

export async function resolveComposeFileName(files) {
  const list = files || (await listComposeFiles())
  const match = findCandidate(list, COMPOSE_CANDIDATES)
  if (match) return match
  return list.find((file) => /\.(ya?ml)$/i.test(file)) || null
}

export async function resolveRouterConfFileName(files) {
  const list = files || (await listComposeFiles())
  return findCandidate(list, ROUTER_CONF_CANDIDATES)
}

export async function getComposeAbsolutePath(relativePath) {
  if (!relativePath) {
    throw fsError(404, 'File belum tersedia')
  }

  const absolutePath = resolve(composeDirPath(), relativePath)
  if (!isInsideComposeDir(absolutePath)) {
    throw fsError(400, 'Path file tidak valid')
  }

  try {
    await stat(absolutePath)
  } catch {
    throw fsError(404, `File tidak ditemukan: ${relativePath}`)
  }

  return absolutePath
}

async function readTextFile(relativePath) {
  if (!relativePath) return null
  const absolutePath = await getComposeAbsolutePath(relativePath)
  return readFile(absolutePath, 'utf8')
}

async function writeTextFile(relativePath, content, label) {
  const text = String(content ?? '')
  if (!text.trim()) {
    throw fsError(400, `Isi ${label} tidak boleh kosong`)
  }

  await ensureComposeDir()
  const absolutePath = resolve(composeDirPath(), relativePath)
  if (!isInsideComposeDir(absolutePath)) {
    throw fsError(400, 'Path file tidak valid')
  }

  await mkdir(join(absolutePath, '..'), { recursive: true })
  await writeFile(absolutePath, text, 'utf8')
  return text
}

/** @deprecated use readEditableConfig */
export async function readComposeYaml() {
  const config = await readEditableConfig()
  return {
    composeFile: config.composeFile,
    content: config.composeContent,
    files: config.files,
    routerConfFile: config.routerConfFile,
    routerConfContent: config.routerConfContent,
  }
}

export async function readEditableConfig() {
  const files = await listComposeFiles()
  const composeFile = await resolveComposeFileName(files)
  const routerConfFile = await resolveRouterConfFileName(files)

  if (!composeFile && !routerConfFile) {
    throw fsError(404, 'Belum ada file compose/router.conf. Ambil compose dulu.')
  }

  return {
    composeFile,
    composeContent: composeFile ? await readTextFile(composeFile) : '',
    routerConfFile,
    routerConfContent: routerConfFile ? await readTextFile(routerConfFile) : '',
    files,
  }
}

/** @deprecated use writeEditableConfig */
export async function writeComposeYaml(content, composeFile) {
  const target =
    composeFile ||
    (await resolveComposeFileName()) ||
    'docker-compose.yml'

  const text = await writeTextFile(target, content, 'YAML')
  return {
    composeFile: target,
    content: text,
  }
}

export async function writeEditableConfig({
  composeFile,
  composeContent,
  routerConfFile,
  routerConfContent,
}) {
  const files = await listComposeFiles()
  const resolvedCompose =
    composeFile ||
    (await resolveComposeFileName(files)) ||
    'docker-compose.yml'
  const resolvedRouter =
    routerConfFile ||
    (await resolveRouterConfFileName(files)) ||
    null

  if (composeContent !== undefined && composeContent !== null) {
    await writeTextFile(resolvedCompose, composeContent, 'docker-compose.yml')
  }

  let routerPath = resolvedRouter
  if (routerConfContent !== undefined && routerConfContent !== null) {
    if (!routerPath) {
      // Prefer sibling of compose file when router.conf belum ada
      const dir = resolvedCompose.includes('/')
        ? resolvedCompose.slice(0, resolvedCompose.lastIndexOf('/'))
        : ''
      routerPath = dir ? `${dir}/router.conf` : 'router.conf'
    }
    await writeTextFile(routerPath, routerConfContent, 'router.conf')
  }

  return {
    composeFile: resolvedCompose,
    composeContent:
      composeContent !== undefined && composeContent !== null
        ? String(composeContent)
        : await readTextFile(resolvedCompose),
    routerConfFile: routerPath,
    routerConfContent:
      routerPath
        ? routerConfContent !== undefined && routerConfContent !== null
          ? String(routerConfContent)
          : await readTextFile(routerPath)
        : '',
  }
}
