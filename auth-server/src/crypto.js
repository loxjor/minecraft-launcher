const crypto = require('crypto')
const fs     = require('fs')
const path   = require('path')

const KEY_DIR      = path.join(__dirname, '..', 'data')
const PRIV_KEY_PATH = path.join(KEY_DIR, 'private.pem')
const PUB_KEY_PATH  = path.join(KEY_DIR, 'public.pem')

let _privateKey  = null
let _publicKeyPem = ''

function initKeys() {
  if (!fs.existsSync(KEY_DIR)) fs.mkdirSync(KEY_DIR, { recursive: true })

  if (fs.existsSync(PRIV_KEY_PATH) && fs.existsSync(PUB_KEY_PATH)) {
    _privateKey   = fs.readFileSync(PRIV_KEY_PATH, 'utf-8')
    _publicKeyPem = fs.readFileSync(PUB_KEY_PATH,  'utf-8')
    console.log('[Crypto] Loaded existing RSA key pair')
    return
  }

  console.log('[Crypto] Generating RSA-4096 key pair (takes ~2s)...')
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })

  _privateKey   = privateKey
  _publicKeyPem = publicKey
  fs.writeFileSync(PRIV_KEY_PATH, privateKey)
  fs.writeFileSync(PUB_KEY_PATH,  publicKey)
  console.log('[Crypto] RSA key pair generated and saved')
}

/** PEM public key — returned as-is in Yggdrasil metadata */
function getPublicKeyPem() { return _publicKeyPem }

/** Sign arbitrary string data with the private key (SHA1withRSA) */
function sign(data) {
  const signer = crypto.createSign('SHA1')
  signer.update(data)
  return signer.sign(_privateKey).toString('base64')
}

module.exports = { initKeys, getPublicKeyPem, sign }
