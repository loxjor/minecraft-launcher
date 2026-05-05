const express = require('express')
const bcrypt  = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { getDB } = require('../database')

const router = express.Router()

const stripDashes = (uuid) => uuid.replace(/-/g, '')

function buildProfile(user) {
  return { id: stripDashes(user.uuid), name: user.username }
}

function forbid(res, msg = 'Invalid token.') {
  return res.status(403).json({ error: 'ForbiddenOperationException', errorMessage: msg })
}

// POST /authserver/authenticate
router.post('/authenticate', async (req, res) => {
  const { username, password, clientToken, requestUser } = req.body || {}

  if (!username || !password)
    return res.status(400).json({ error: 'IllegalArgumentException', errorMessage: 'username and password are required' })

  const db = getDB()

  try {
    const user = db.users.findByUsernameOrEmail(username)
    if (!user) return forbid(res, 'Invalid credentials. Invalid username or password.')

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) return forbid(res, 'Invalid credentials. Invalid username or password.')

    // One session at a time
    db.tokens.deleteByUserId(user.id)

    const accessToken     = uuidv4()
    const usedClientToken = clientToken || uuidv4()
    db.tokens.insert({ user_id: user.id, access_token: accessToken, client_token: usedClientToken })

    const profile  = buildProfile(user)
    const response = { accessToken, clientToken: usedClientToken, availableProfiles: [profile], selectedProfile: profile }

    if (requestUser) {
      response.user = { id: stripDashes(user.uuid), username: user.username, properties: [] }
    }

    console.log(`[Auth] Login: ${user.username}`)
    res.json(response)
  } catch (err) {
    console.error('[Auth] authenticate error:', err)
    res.status(500).json({ error: 'InternalError', errorMessage: 'Internal server error' })
  }
})

// POST /authserver/refresh
router.post('/refresh', (req, res) => {
  const { accessToken, clientToken } = req.body || {}
  const db    = getDB()
  const token = db.tokens.findWithUser(accessToken)

  if (!token) return forbid(res)
  if (clientToken && token.client_token !== clientToken) return forbid(res, 'Token client mismatch.')

  const newToken = uuidv4()
  db.tokens.updateAccessToken(token.id, newToken)

  res.json({ accessToken: newToken, clientToken: token.client_token, selectedProfile: buildProfile(token) })
})

// POST /authserver/validate
router.post('/validate', (req, res) => {
  const { accessToken, clientToken } = req.body || {}
  const db    = getDB()
  const token = db.tokens.findWithUser(accessToken)

  if (!token) return forbid(res)
  if (clientToken && token.client_token !== clientToken) return forbid(res, 'Token client mismatch.')

  res.status(204).send()
})

// POST /authserver/invalidate
router.post('/invalidate', (req, res) => {
  const { accessToken } = req.body || {}
  getDB().tokens.deleteByAccessToken(accessToken)
  res.status(204).send()
})

// POST /authserver/signout
router.post('/signout', async (req, res) => {
  const { username, password } = req.body || {}
  const db   = getDB()
  const user = db.users.findByUsernameOrEmail(username)

  if (user && password) {
    const valid = await bcrypt.compare(password, user.password_hash)
    if (valid) {
      db.tokens.deleteByUserId(user.id)
      console.log(`[Auth] Signout: ${user.username}`)
    }
  }

  res.status(204).send()
})

module.exports = router
