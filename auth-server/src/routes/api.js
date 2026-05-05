const express = require('express')
const bcrypt  = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { getDB } = require('../database')
const { hasSkin, saveSkin, deleteSkin, isValidPng, saveDefaultSkin } = require('../skins')

const router = express.Router()

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))

// ─── Register ────────────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body || {}

  if (!username || !email || !password)
    return res.status(400).json({ error: 'Missing required fields: username, email, password' })
  if (username.length < 3 || username.length > 16)
    return res.status(400).json({ error: 'Username must be 3–16 characters' })
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Username can only contain letters, numbers and underscores' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' })
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const db = getDB()
  try {
    if (db.users.existsByUsernameOrEmail(username, email))
      return res.status(409).json({ error: 'Username or email is already taken' })

    const passwordHash = await bcrypt.hash(password, 10)
    db.users.insert({ username, email, password_hash: passwordHash, uuid: uuidv4(), skin_model: 'classic' })

    console.log(`[API] Registered: ${username}`)
    res.json({ success: true, message: 'Account created successfully' })
  } catch (err) {
    console.error('[API] Register error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Skin upload ──────────────────────────────────────────────────────────────

// POST /api/skin  { accessToken, skinData: base64PNG, model: 'classic'|'slim' }
router.post('/skin', (req, res) => {
  const { accessToken, skinData, model } = req.body || {}

  const db    = getDB()
  const token = db.tokens.findWithUser(accessToken)
  if (!token) return res.status(403).json({ error: 'Unauthorized' })
  if (!skinData) return res.status(400).json({ error: 'Missing skinData' })

  let buffer
  try { buffer = Buffer.from(skinData, 'base64') }
  catch { return res.status(400).json({ error: 'Invalid base64 data' }) }

  if (!isValidPng(buffer))
    return res.status(400).json({ error: 'File must be a valid PNG image' })
  if (buffer.length > 1024 * 1024)
    return res.status(400).json({ error: 'Skin file too large (max 1 MB)' })

  saveSkin(token.email, buffer)
  db.users.setSkinModel(token.user_id, model === 'slim' ? 'slim' : 'classic')

  console.log(`[API] Skin uploaded for ${token.username} <${token.email}> (model: ${model || 'classic'})`)
  res.json({ success: true })
})

// DELETE /api/skin  { accessToken }
router.delete('/skin', (req, res) => {
  const { accessToken } = req.body || {}

  const db    = getDB()
  const token = db.tokens.findWithUser(accessToken)
  if (!token) return res.status(403).json({ error: 'Unauthorized' })

  deleteSkin(token.email)
  db.users.setSkinModel(token.user_id, 'classic')

  console.log(`[API] Skin deleted for ${token.username}`)
  res.json({ success: true })
})

// GET /api/skin/info  — check whether current user has a custom skin
router.get('/skin/info', (req, res) => {
  const { accessToken } = req.query

  const db    = getDB()
  const token = db.tokens.findWithUser(accessToken)
  if (!token) return res.status(403).json({ error: 'Unauthorized' })

  res.json({
    hasSkin: hasSkin(token.email),
    model:   token.skin_model || 'classic'
  })
})

// POST /api/skin/default  — set the global default skin (no auth, local only)
router.post('/skin/default', (req, res) => {
  const { skinData } = req.body || {}
  if (!skinData) return res.status(400).json({ error: 'Missing skinData' })

  let buffer
  try { buffer = Buffer.from(skinData, 'base64') }
  catch { return res.status(400).json({ error: 'Invalid base64 data' }) }

  if (!isValidPng(buffer))
    return res.status(400).json({ error: 'File must be a valid PNG image' })
  if (buffer.length > 1024 * 1024)
    return res.status(400).json({ error: 'Skin file too large (max 1 MB)' })

  saveDefaultSkin(buffer)
  console.log('[API] Default skin updated')
  res.json({ success: true })
})

// ─── Username change ──────────────────────────────────────────────────────────

const USERNAME_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 1 day

// PUT /api/username  { accessToken, username }
router.put('/username', (req, res) => {
  const { accessToken, username } = req.body || {}

  const db    = getDB()
  const token = db.tokens.findWithUser(accessToken)
  if (!token) return res.status(403).json({ error: 'Unauthorized' })

  if (!username || username.length < 3 || username.length > 16)
    return res.status(400).json({ error: 'Username must be 3–16 characters' })
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Username can only contain letters, numbers and underscores' })

  // Check cooldown
  const user     = db.users.findById(token.user_id)
  const changedAt = new Date(user.username_changed_at || user.created_at).getTime()
  const elapsed   = Date.now() - changedAt
  if (elapsed < USERNAME_COOLDOWN_MS) {
    const remainsMs = USERNAME_COOLDOWN_MS - elapsed
    return res.status(429).json({
      error: 'CooldownActive',
      remainsMs,
      message: `Username can be changed again in ${Math.ceil(remainsMs / 3600000)} hour(s)`
    })
  }

  // Check uniqueness (exclude self)
  const existing = db.users.findByUsernameOrEmail(username)
  if (existing && existing.id !== token.user_id)
    return res.status(409).json({ error: 'Username is already taken' })

  db.users.setUsername(token.user_id, username)
  console.log(`[API] Username changed: ${token.username} → ${username}`)
  res.json({ success: true, username })
})

// ─── Launcher version ─────────────────────────────────────────────────────────

router.get('/launcher/version', (_req, res) => {
  res.json({ version: '1.0.0', downloadUrl: null, changelog: 'Initial release' })
})

module.exports = router
