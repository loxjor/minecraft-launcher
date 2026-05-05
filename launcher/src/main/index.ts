import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import { loadConfig, saveConfig, LauncherConfig } from './config'
import * as Auth from './auth'
import { findJava, downloadJava } from './java'
import { getVersionList, downloadVersion, launchGame } from './minecraft'

// ─── Paths ───────────────────────────────────────────────────────────────────

const DATA_DIR = path.join(app.getPath('userData'), 'data')
const JAVA_DIR = path.join(DATA_DIR, 'java')

function ensureDirs() {
  for (const d of [DATA_DIR, JAVA_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true })
  }
}

// ─── Window ──────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let activeGame: ReturnType<typeof import('child_process').spawn> | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 620,
    minWidth: 800,
    minHeight: 500,
    frame: false,       // custom title bar
    backgroundColor: '#0f0f0f',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  ensureDirs()
  createWindow()
  app.on('activate', () => { if (!mainWindow) createWindow() })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Window controls (custom frame) ──────────────────────────────────────────

ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.on('window:close', () => mainWindow?.close())

// ─── Config ──────────────────────────────────────────────────────────────────

ipcMain.handle('config:get', () => loadConfig())
ipcMain.handle('config:set', (_e, config: LauncherConfig) => {
  saveConfig(config)
  return true
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

ipcMain.handle('auth:register', async (_e, username: string, email: string, password: string) => {
  const cfg = loadConfig()
  await Auth.register(cfg.authServerUrl, username, email, password)
  return { success: true }
})

ipcMain.handle('auth:login', async (_e, username: string, password: string) => {
  const cfg = loadConfig()
  const profile = await Auth.login(cfg.authServerUrl, username, password, cfg.clientToken || undefined)

  saveConfig({
    ...cfg,
    accessToken: profile.accessToken,
    clientToken: profile.clientToken,
    username: profile.username,
    uuid: profile.uuid
  })

  return profile
})

ipcMain.handle('auth:logout', async () => {
  const cfg = loadConfig()
  if (cfg.accessToken) {
    await Auth.logout(cfg.authServerUrl, cfg.accessToken)
  }
  saveConfig({ ...cfg, accessToken: '', clientToken: '', username: '', uuid: '' })
  return true
})

ipcMain.handle('auth:validate', async () => {
  const cfg = loadConfig()
  if (!cfg.accessToken) return false
  return Auth.validate(cfg.authServerUrl, cfg.accessToken, cfg.clientToken)
})

// ─── Java ─────────────────────────────────────────────────────────────────────

ipcMain.handle('java:check', async () => {
  const cfg = loadConfig()
  return findJava(JAVA_DIR, cfg.javaPath)
})

ipcMain.handle('java:install', async () => {
  if (!mainWindow) throw new Error('No window')
  const exe = await downloadJava(JAVA_DIR, mainWindow)
  const cfg = loadConfig()
  saveConfig({ ...cfg, javaPath: exe })
  return exe
})

// ─── Minecraft ────────────────────────────────────────────────────────────────

ipcMain.handle('minecraft:versions', async () => {
  return getVersionList()
})

ipcMain.handle('minecraft:download', async (_e, version: string) => {
  if (!mainWindow) throw new Error('No window')
  await downloadVersion(version, DATA_DIR, mainWindow)
  return true
})

ipcMain.handle('minecraft:launch', async (_e, opts: {
  version: string
  memory: number
}) => {
  if (!mainWindow) throw new Error('No window')
  if (activeGame) throw new Error('Game is already running')

  const cfg = loadConfig()
  if (!cfg.accessToken || !cfg.uuid) throw new Error('Not logged in')

  const javaInfo = await findJava(JAVA_DIR, cfg.javaPath)
  if (!javaInfo) throw new Error('Java not found. Please install Java first.')

  activeGame = launchGame({
    version: opts.version,
    username: cfg.username,
    uuid: cfg.uuid,
    accessToken: cfg.accessToken,
    authServerUrl: cfg.authServerUrl,
    memory: opts.memory,
    javaExe: javaInfo.path,
    dataDir: DATA_DIR,
    gameDir: cfg.gameDir
  }, mainWindow)

  activeGame.on('close', () => { activeGame = null })
  return true
})

ipcMain.handle('minecraft:kill', () => {
  activeGame?.kill()
  activeGame = null
  return true
})

ipcMain.handle('shell:openDir', (_e, dirPath: string) => {
  shell.openPath(dirPath)
})

// ─── File dialog ──────────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async (_e, filters: { name: string; extensions: string[] }[]) => {
  if (!mainWindow) return null
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters
  })
  return result.canceled ? null : result.filePaths[0]
})

// ─── Skin ─────────────────────────────────────────────────────────────────────

ipcMain.handle('skin:upload', async (_e, filePath: string, model: string) => {
  const cfg = loadConfig()
  if (!cfg.accessToken) throw new Error('Not logged in')

  const buffer   = fs.readFileSync(filePath)
  const skinData = buffer.toString('base64')

  await axios.post(`${cfg.authServerUrl}/api/skin`, {
    accessToken: cfg.accessToken,
    skinData,
    model
  }, { timeout: 15_000 })

  return true
})

ipcMain.handle('skin:delete', async () => {
  const cfg = loadConfig()
  if (!cfg.accessToken) throw new Error('Not logged in')

  await axios.delete(`${cfg.authServerUrl}/api/skin`, {
    data:    { accessToken: cfg.accessToken },
    timeout: 10_000
  })
  return true
})
