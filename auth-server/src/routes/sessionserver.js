const express = require('express')
const { getDB } = require('../database')
const { sign }  = require('../crypto')
const { hasSkin, hasDefaultSkin } = require('../skins')

const router = express.Router()

const PORT = process.env.PORT || 3000
const HOST = process.env.PUBLIC_HOST || `localhost:${PORT}`
const stripDashes = (uuid) => uuid.replace(/-/g, '')

function makeTexturesProperty(user) {
  const uuidNoDashes = stripDashes(user.uuid)
  const email        = user.email || ''
  const textures     = {}

  if (email && hasSkin(email)) {
    textures.SKIN = {
      url: `http://${HOST}/skins/${encodeURIComponent(email)}.png`
    }
    if (user.skin_model === 'slim') {
      textures.SKIN.metadata = { model: 'slim' }
    }
  } else if (hasDefaultSkin()) {
    textures.SKIN = {
      url: `http://${HOST}/skins/default.png`
    }
  }

  const payload = JSON.stringify({
    timestamp:   Date.now(),
    profileId:   uuidNoDashes,
    profileName: user.username,
    textures
  })

  const value     = Buffer.from(payload).toString('base64')
  const signature = sign(value)

  return [{ name: 'textures', value, signature }]
}

// POST /sessionserver/session/minecraft/join
router.post('/session/minecraft/join', (req, res) => {
  const { accessToken, selectedProfile, serverId } = req.body || {}
  const db    = getDB()
  const token = db.tokens.findWithUser(accessToken)

  if (!token)
    return res.status(403).json({ error: 'ForbiddenOperationException', errorMessage: 'Invalid token' })
  if (stripDashes(token.uuid) !== selectedProfile)
    return res.status(403).json({ error: 'ForbiddenOperationException', errorMessage: 'Profile mismatch' })

  db.sessions.deleteByUserId(token.user_id)
  db.sessions.insert({ user_id: token.user_id, server_id: serverId })

  res.status(204).send()
})

// GET /sessionserver/session/minecraft/hasJoined
router.get('/session/minecraft/hasJoined', (req, res) => {
  const { username, serverId } = req.query
  const db      = getDB()
  const session = db.sessions.findByUsernameAndServer(username, serverId)

  if (!session) return res.status(204).send()

  db.sessions.deleteById(session.id)

  // Fetch full user to get skin_model
  const user = db.users.findByUsernameOrEmail(session.username)

  res.json({
    id:         stripDashes(session.uuid),
    name:       session.username,
    properties: makeTexturesProperty(user || session)
  })
})

// GET /sessionserver/session/minecraft/profile/:uuid
router.get('/session/minecraft/profile/:uuid', (req, res) => {
  const db   = getDB()
  const user = db.users.findByUUID(req.params.uuid)

  if (!user) return res.status(404).json({ error: 'Profile not found' })

  const unsigned = req.query.unsigned === 'true'
  const prop     = makeTexturesProperty(user)[0]

  res.json({
    id:         stripDashes(user.uuid),
    name:       user.username,
    properties: [unsigned ? { name: prop.name, value: prop.value } : prop]
  })
})

module.exports = router
