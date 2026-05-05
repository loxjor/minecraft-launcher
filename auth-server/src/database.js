/**
 * Lightweight JSON-based store. No native dependencies.
 * Data is persisted to data/db.json on every write.
 */
const fs   = require('fs')
const path = require('path')

const DB_DIR  = path.join(__dirname, '..', 'data')
const DB_FILE = path.join(DB_DIR, 'db.json')

let _store = {
  users:    [],   // { id, username, email, password_hash, uuid, created_at }
  tokens:   [],   // { id, user_id, access_token, client_token, created_at }
  sessions: []    // { id, user_id, server_id, created_at }
}

let _seq = { users: 1, tokens: 1, sessions: 1 }

// ─── Persistence ──────────────────────────────────────────────────────────────

function _load() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
      _store = parsed.store || _store
      _seq   = parsed.seq   || _seq
    } catch (e) {
      console.warn('[DB] Could not parse db.json, starting fresh:', e.message)
    }
  }
}

function _save() {
  fs.writeFileSync(DB_FILE, JSON.stringify({ store: _store, seq: _seq }, null, 2), 'utf-8')
}

// ─── Generic table helpers ────────────────────────────────────────────────────

function _findOne(table, predFn) {
  return _store[table].find(predFn) ?? null
}

function _insert(table, data) {
  const record = { id: _seq[table]++, created_at: new Date().toISOString(), ...data }
  _store[table].push(record)
  _save()
  return record
}

function _update(table, predFn, updates) {
  const idx = _store[table].findIndex(predFn)
  if (idx < 0) return null
  _store[table][idx] = { ..._store[table][idx], ...updates }
  _save()
  return _store[table][idx]
}

function _deleteWhere(table, predFn) {
  const before = _store[table].length
  _store[table] = _store[table].filter(r => !predFn(r))
  if (_store[table].length !== before) _save()
}

// ─── Public API ───────────────────────────────────────────────────────────────

const db = {
  users: {
    findByUsernameOrEmail(login) {
      return _findOne('users', u => u.username === login || u.email === login)
    },
    findByUUID(rawUUID) {
      const clean = rawUUID.replace(/-/g, '')
      return _findOne('users', u => u.uuid.replace(/-/g, '') === clean)
    },
    existsByUsernameOrEmail(username, email) {
      return !!_findOne('users', u => u.username === username || u.email === email)
    },
    insert(data)  { return _insert('users', { username_changed_at: new Date().toISOString(), ...data }) },
    findById(id)  { return _findOne('users', u => u.id === id) },
    setSkinModel(userId, model) {
      _update('users', u => u.id === userId, { skin_model: model })
    },
    setUsername(userId, username) {
      return _update('users', u => u.id === userId, { username, username_changed_at: new Date().toISOString() })
    }
  },

  tokens: {
    findWithUser(accessToken) {
      const token = _findOne('tokens', t => t.access_token === accessToken)
      if (!token) return null
      const user  = _findOne('users',  u => u.id === token.user_id)
      if (!user)  return null
      return { ...token, username: user.username, uuid: user.uuid, email: user.email }
    },
    insert(data)  { return _insert('tokens', data) },
    updateAccessToken(id, newToken) {
      return _update('tokens', t => t.id === id, { access_token: newToken })
    },
    deleteByUserId(userId) { _deleteWhere('tokens', t => t.user_id === userId) },
    deleteByAccessToken(at) { _deleteWhere('tokens', t => t.access_token === at) }
  },

  sessions: {
    findByUsernameAndServer(username, serverId) {
      const user = _findOne('users', u => u.username === username)
      if (!user) return null
      const session = _findOne('sessions', s => s.user_id === user.id && s.server_id === serverId)
      if (!session) return null
      return { ...session, username: user.username, uuid: user.uuid }
    },
    insert(data)  { return _insert('sessions', data) },
    deleteById(id)         { _deleteWhere('sessions', s => s.id === id) },
    deleteByUserId(userId) { _deleteWhere('sessions', s => s.user_id === userId) }
  }
}

function initDatabase() {
  _load()
  console.log('[DB] JSON database ready at', DB_FILE)
  return db
}

function getDB() { return db }

module.exports = { initDatabase, getDB }
