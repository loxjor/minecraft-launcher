const path = require('path')
const fs   = require('fs')

const SKINS_DIR = path.join(__dirname, '..', 'data', 'skins')

function ensureDir() {
  if (!fs.existsSync(SKINS_DIR)) fs.mkdirSync(SKINS_DIR, { recursive: true })
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47])

function isValidPng(buffer) {
  return buffer.length >= 4 && buffer.slice(0, 4).equals(PNG_MAGIC)
}

function skinPath(uuidNoDashes) {
  return path.join(SKINS_DIR, `${uuidNoDashes}.png`)
}

function hasSkin(uuidNoDashes) {
  return fs.existsSync(skinPath(uuidNoDashes))
}

function saveSkin(uuidNoDashes, buffer) {
  ensureDir()
  fs.writeFileSync(skinPath(uuidNoDashes), buffer)
}

function deleteSkin(uuidNoDashes) {
  const p = skinPath(uuidNoDashes)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

module.exports = { SKINS_DIR, skinPath, hasSkin, saveSkin, deleteSkin, isValidPng }
