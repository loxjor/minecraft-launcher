import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

export type AuthMode = 'custom' | 'ely' | 'mojang'

export interface LauncherConfig {
  authMode: AuthMode
  authServerUrl: string
  selectedVersion: string
  memory: number          // MB
  javaPath: string
  gameDir: string
  accessToken: string
  clientToken: string
  username: string
  uuid: string
  email: string
}

const DEFAULTS: LauncherConfig = {
  authMode: 'custom',
  authServerUrl: 'http://localhost:3000',
  selectedVersion: '1.20.4',
  memory: 2048,
  javaPath: '',
  gameDir: path.join(app.getPath('userData'), 'game'),
  accessToken: '',
  clientToken: '',
  username: '',
  uuid: '',
  email: ''
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
