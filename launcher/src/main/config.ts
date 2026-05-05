import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

export interface LauncherConfig {
  authServerUrl: string
  selectedVersion: string
  memory: number          // MB
  javaPath: string
  gameDir: string
  accessToken: string
  clientToken: string
  username: string
  uuid: string
}

const DEFAULTS: LauncherConfig = {
  authServerUrl: 'http://localhost:3000',
  selectedVersion: '1.20.4',
  memory: 2048,
  javaPath: '',
  gameDir: path.join(app.getPath('userData'), 'game'),
  accessToken: '',
  clientToken: '',
  username: '',
  uuid: ''
}

export function loadConfig(): LauncherConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
      return { ...DEFAULTS, ...JSON.parse(raw) }
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS }
}

export function saveConfig(config: LauncherConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}
