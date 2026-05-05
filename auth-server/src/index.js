const express = require('express')
const cors    = require('cors')
const { initDatabase }  = require('./database')
const { initKeys, getPublicKeyPem } = require('./crypto')
const { SKINS_DIR, DEFAULT_SKIN_PATH, hasDefaultSkin } = require('./skins')
const apiRouter          = require('./routes/api')
const authserverRouter   = require('./routes/authserver')
const sessionserverRouter = require('./routes/sessionserver')

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

initDatabase()
initKeys()   // generate or load RSA key pair

// Yggdrasil meta — authlib-injector fetches this on startup
app.get('/', (_req, res) => {
  const base = `http://localhost:${PORT}`
  res.json({
    meta: {
      serverName: 'MC Auth Server',
      implementationName: 'custom-yggdrasil',
      implementationVersion: '1.0.0',
      links: {
        homepage: base,
        register: `${base}/api/register`
      },
      feature: { non_email_login: true }
    },
    skinDomains: ['localhost', '127.0.0.1'],
    signaturePublickey: getPublicKeyPem()
  })
})

app.use('/api', apiRouter)
app.use('/authserver', authserverRouter)
app.use('/sessionserver', sessionserverRouter)
// Serve skin PNG files: GET /skins/{uuidNoDashes}.png
// If the specific skin doesn't exist, fall back to default.png
app.use('/skins', express.static(SKINS_DIR))
app.get('/skins/:file', (_req, res) => {
  // express.static calls next() when file not found — we catch it here
  if (hasDefaultSkin()) {
    res.sendFile(DEFAULT_SKIN_PATH)
  } else {
    res.status(404).json({ error: 'Skin not found' })
  }
})

app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

app.listen(PORT, () => {
  console.log(`\n✅ Auth server running at http://localhost:${PORT}`)
  console.log(`   Register: POST http://localhost:${PORT}/api/register`)
  console.log(`   Login:    POST http://localhost:${PORT}/authserver/authenticate\n`)
})
