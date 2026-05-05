const path = require('path')
const fs   = require('fs')

const SKINS_DIR          = path.join(__dirname, '..', 'data', 'skins')
const DEFAULT_SKIN_PATH  = path.join(SKINS_DIR, 'default.png')

function ensureDir() {
  if (!fs.existsSync(SKINS_DIR)) fs.mkdirSync(SKINS_DIR, { recursive: true })
}

function hasDefaultSkin() {
  return fs.existsSync(DEFAULT_SKIN_PATH)
}

function saveDefaultSkin(buffer) {
  ensureDir()
  fs.writeFileSync(DEFAULT_SKIN_PATH, buffer)
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function isValidPng(buffer) {
  return buffer.length >= 4 && buffer.slice(0, 4).equals(PNG_MAGIC)
}

// key = email (e.g. "user@example.com") — used as filename
function skinPath(key) {
  return path.join(SKINS_DIR, `${key}.png`)
}

function hasSkin(key) {
  return fs.existsSync(skinPath(key))
}

function saveSkin(key, buffer) {
  ensureDir()
  fs.writeFileSync(skinPath(key), buffer)
}

function deleteSkin(key) {
  const p = skinPath(key)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

module.exports = { SKINS_DIR, DEFAULT_SKIN_PATH, skinPath, hasSkin, saveSkin, deleteSkin, isValidPng, hasDefaultSkin, saveDefaultSkin }
