import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import Database from 'better-sqlite3'

const SESSION_DAYS = 7
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

let db

function dbPath() {
  return join(process.cwd(), '.data', 'auth.sqlite')
}

export function getAuthDb() {
  if (db) return db

  mkdirSync(join(process.cwd(), '.data'), { recursive: true })
  db = new Database(dbPath())
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  seedDefaultUser(db)
  return db
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt)
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(expectedHash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function seedDefaultUser(database) {
  const row = database.prepare('SELECT COUNT(*) AS count FROM users').get()
  if (row.count > 0) return

  const username = String(process.env.AUTH_USERNAME || 'admin').trim() || 'admin'
  const password = String(process.env.AUTH_PASSWORD || 'admin123')
  const { salt, hash } = hashPassword(password)

  database
    .prepare(
      'INSERT INTO users (username, password_hash, salt, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(username, hash, salt, Date.now())

  console.info(
    `[auth] Seeded default user "${username}". Change AUTH_PASSWORD in .env for production.`,
  )
}

export function findUserByUsername(username) {
  return getAuthDb()
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(String(username || '').trim())
}

export function authenticateUser(username, password) {
  const user = findUserByUsername(username)
  if (!user) return null
  if (!verifyPassword(password, user.salt, user.password_hash)) return null
  return { id: user.id, username: user.username }
}

export function createSession(userId) {
  const id = randomBytes(32).toString('hex')
  const now = Date.now()
  const expiresAt = now + SESSION_MS

  getAuthDb()
    .prepare(
      'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(id, userId, expiresAt, now)

  return { id, expiresAt, maxAge: Math.floor(SESSION_MS / 1000) }
}

export function getSessionUser(sessionId) {
  if (!sessionId) return null

  const row = getAuthDb()
    .prepare(
      `
      SELECT sessions.id AS session_id, sessions.expires_at, users.id AS user_id, users.username
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
    `,
    )
    .get(sessionId)

  if (!row) return null
  if (row.expires_at < Date.now()) {
    deleteSession(sessionId)
    return null
  }

  return { id: row.user_id, username: row.username }
}

export function deleteSession(sessionId) {
  if (!sessionId) return
  getAuthDb().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function purgeExpiredSessions() {
  getAuthDb()
    .prepare('DELETE FROM sessions WHERE expires_at < ?')
    .run(Date.now())
}

export const SESSION_COOKIE = 'dr_session'
