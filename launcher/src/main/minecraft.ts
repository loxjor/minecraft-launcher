import path from 'path'
import fs from 'fs'
import { spawn, ChildProcess } from 'child_process'
import axios from 'axios'
import AdmZip from 'adm-zip'
import { BrowserWindow } from 'electron'

const VERSION_MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const RESOURCES_URL    = 'https://resources.download.minecraft.net'
// authlib-injector v1.2.5 (stable)
const AUTHLIB_URL = 'https://github.com/yushijinhun/authlib-injector/releases/download/v1.2.5/authlib-injector-1.2.5.jar'

export interface LaunchOptions {
  version: string
  username: string
  uuid: string
  accessToken: string
  authMode: string
  authServerUrl: string
  memory: number          // MB
  javaExe: string
  dataDir: string
  gameDir: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (cur: number, total: number) => void
): Promise<void> {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  if (fs.existsSync(dest)) return  // already downloaded

  const res = await axios.get(url, {
    responseType: 'stream',
    timeout: 120_000,
    headers: { 'User-Agent': 'MCLauncher/1.0' }
  })

  const total = parseInt(res.headers['content-length'] || '0', 10)
  let cur = 0

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(dest)
    res.data.on('data', (chunk: Buffer) => {
      cur += chunk.length
      onProgress?.(cur, total)
    })
    res.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })
}

function checkRules(rules: any[]): boolean {
  if (!rules || rules.length === 0) return true

  const currentOS =
    process.platform === 'win32' ? 'windows' :
    process.platform === 'darwin' ? 'osx' : 'linux'

  let allowed = false
  let anyApplied = false

  for (const rule of rules) {
    // Skip feature-conditional rules (is_demo_user, has_quick_plays_support, etc.)
    // We don't support these features, so don't include them
    if (rule.features && Object.keys(rule.features).length > 0) continue

    const applies = !rule.os || rule.os.name === currentOS
    if (applies) {
      anyApplied = true
      allowed = rule.action === 'allow'
    }
  }

  // If only feature rules existed, don't include
  if (!anyApplied) return false
  return allowed
}

function substituteTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{([^}]+)\}/g, (_, key) => vars[key] ?? '')
}

// Remove --flag '' pairs and standalone empty strings from arg list
function filterEmptyArgs(args: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '') continue
    // If this is a named flag and next value is empty, skip both
    if (arg.startsWith('--') && i + 1 < args.length && args[i + 1] === '') {
      i++
      continue
    }
    out.push(arg)
  }
  return out
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getVersionList(): Promise<{ id: string; type: string; releaseTime: string }[]> {
  const res = await axios.get(VERSION_MANIFEST, { timeout: 10_000 })
  return res.data.versions
    .filter((v: any) => v.type === 'release' || v.type === 'snapshot')
    .map((v: any) => ({ id: v.id, type: v.type, releaseTime: v.releaseTime }))
}

export async function downloadVersion(
  version: string,
  dataDir: string,
  win: BrowserWindow
): Promise<void> {
  const sendProgress = (phase: string, cur: number, total: number) =>
    win.webContents.send('download:progress', { phase, current: cur, total })

  // 1. Version manifest
  sendProgress('manifest', 0, 1)
  const manifestRes = await axios.get(VERSION_MANIFEST, { timeout: 10_000 })
  const versionEntry = manifestRes.data.versions.find((v: any) => v.id === version)
  if (!versionEntry) throw new Error(`Version ${version} not found`)

  // 2. Version JSON
  const versionDir = path.join(dataDir, 'versions', version)
  const versionJsonPath = path.join(versionDir, `${version}.json`)
  fs.mkdirSync(versionDir, { recursive: true })

  let versionJson: any
  if (fs.existsSync(versionJsonPath)) {
    versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'))
  } else {
    const vjRes = await axios.get(versionEntry.url, { timeout: 10_000 })
    versionJson = vjRes.data
    fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2))
  }

  // 3. Client JAR
  sendProgress('client-jar', 0, 1)
  const clientJarPath = path.join(versionDir, `${version}.jar`)
  if (!fs.existsSync(clientJarPath)) {
    const clientDl = versionJson.downloads?.client
    if (clientDl) {
      await downloadFile(clientDl.url, clientJarPath, (cur, total) =>
        sendProgress('client-jar', cur, total)
      )
    }
  }

  // 4. Libraries
  const libraries: any[] = versionJson.libraries || []
  const libsDir = path.join(dataDir, 'libraries')
  const nativesDir = path.join(versionDir, 'natives')
  fs.mkdirSync(nativesDir, { recursive: true })

  let libIndex = 0
  for (const lib of libraries) {
    libIndex++
    if (!checkRules(lib.rules)) continue

    // Artifact (regular jar)
    if (lib.downloads?.artifact) {
      const art = lib.downloads.artifact
      const dest = path.join(libsDir, art.path)
      sendProgress('libraries', libIndex, libraries.length)
      await downloadFile(art.url, dest)
    }

    // Natives classifier
    const os = process.platform === 'win32' ? 'windows' :
               process.platform === 'darwin' ? 'osx' : 'linux'
    const nativeKey = lib.natives?.[os]?.replace('${arch}', '64')

    if (nativeKey && lib.downloads?.classifiers?.[nativeKey]) {
      const nat = lib.downloads.classifiers[nativeKey]
      const tmpPath = path.join(libsDir, nat.path)
      await downloadFile(nat.url, tmpPath)

      // Extract to natives dir
      try {
        const zip = new AdmZip(tmpPath)
        const exclude = lib.extract?.exclude || []
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue
          if (exclude.some((e: string) => entry.entryName.startsWith(e))) continue
          const outPath = path.join(nativesDir, path.basename(entry.entryName))
          fs.mkdirSync(path.dirname(outPath), { recursive: true })
          fs.writeFileSync(outPath, entry.getData())
        }
      } catch {
        // natives extraction errors are non-fatal
      }
    }
  }

  // 5. Asset index
  sendProgress('assets-index', 0, 1)
  const assetIndexInfo = versionJson.assetIndex
  const assetIndexPath = path.join(dataDir, 'assets', 'indexes', `${assetIndexInfo.id}.json`)
  fs.mkdirSync(path.dirname(assetIndexPath), { recursive: true })

  let assetIndex: any
  if (fs.existsSync(assetIndexPath)) {
    assetIndex = JSON.parse(fs.readFileSync(assetIndexPath, 'utf-8'))
  } else {
    const aiRes = await axios.get(assetIndexInfo.url, { timeout: 10_000 })
    assetIndex = aiRes.data
    fs.writeFileSync(assetIndexPath, JSON.stringify(assetIndex))
  }

  // 6. Assets
  const objects = Object.values(assetIndex.objects) as any[]
  let assetsDone = 0
  const concurrency = 8
  const assetsDir = path.join(dataDir, 'assets', 'objects')

  async function downloadAsset(obj: any) {
    const hash: string = obj.hash
    const subdir = hash.substring(0, 2)
    const dest = path.join(assetsDir, subdir, hash)
    await downloadFile(`${RESOURCES_URL}/${subdir}/${hash}`, dest)
    assetsDone++
    sendProgress('assets', assetsDone, objects.length)
  }

  // Batch downloads with limited concurrency
  for (let i = 0; i < objects.length; i += concurrency) {
    await Promise.all(objects.slice(i, i + concurrency).map(downloadAsset))
  }

  // 7. authlib-injector
  sendProgress('authlib', 0, 1)
  const authlibPath = path.join(dataDir, 'authlib-injector.jar')
  await downloadFile(AUTHLIB_URL, authlibPath, (cur, total) =>
    sendProgress('authlib', cur, total)
  )

  sendProgress('done', 1, 1)
}

export function launchGame(options: LaunchOptions, win: BrowserWindow): ChildProcess {
  const {
    version, username, uuid, accessToken,
    authMode, authServerUrl, memory, javaExe, dataDir, gameDir
  } = options

  const versionDir   = path.join(dataDir, 'versions', version)
  const nativesDir   = path.join(versionDir, 'natives')
  const libsDir      = path.join(dataDir, 'libraries')
  const assetsDir    = path.join(dataDir, 'assets')
  const authlibJar   = path.join(dataDir, 'authlib-injector.jar')
  const versionJson  = JSON.parse(
    fs.readFileSync(path.join(versionDir, `${version}.json`), 'utf-8')
  )

  fs.mkdirSync(gameDir, { recursive: true })

  // Build classpath
  const classpath: string[] = []

  for (const lib of versionJson.libraries || []) {
    if (!checkRules(lib.rules)) continue
    if (lib.downloads?.artifact) {
      const p = path.join(libsDir, lib.downloads.artifact.path)
      if (fs.existsSync(p)) classpath.push(p)
    }
  }
  classpath.push(path.join(versionDir, `${version}.jar`))
  const cp = classpath.join(process.platform === 'win32' ? ';' : ':')

  const templateVars: Record<string, string> = {
    natives_directory:  nativesDir,
    launcher_name:      'MCLauncher',
    launcher_version:   '1.0.0',
    classpath:          cp,
    auth_player_name:   username,
    version_name:       version,
    game_directory:     gameDir,
    assets_root:        assetsDir,
    assets_index_name:  versionJson.assetIndex?.id || version,
    auth_uuid:          uuid,
    auth_access_token:  accessToken,
    user_type:          'mojang',
    version_type:       versionJson.type || 'release',
    resolution_width:   '854',
    resolution_height:  '480',
    clientid:           '',
    auth_xuid:          ''
  }

  // JVM args — only what the version JSON doesn't handle itself.
  // -Djava.library.path, -Dminecraft.launcher.*, -cp are injected via ${templateVars}
  // by the version JSON's arguments.jvm section, so we don't add them here.
  // authlib-injector: custom → own server, ely → ely.by, mojang → not needed
  const authlibTarget = authMode === 'mojang' ? null
    : authMode === 'ely' ? 'https://authserver.ely.by'
    : authServerUrl

  const jvmArgs: string[] = [
    ...(authlibTarget ? [`-javaagent:${authlibJar}=${authlibTarget}`] : []),
    `-Xmx${memory}M`,
    `-Xms512M`,
    '-XX:+UseG1GC',
    '-XX:+ParallelRefProcEnabled',
    '-XX:MaxGCPauseMillis=200'
  ]

  // Process version JSON JVM args (modern format)
  if (versionJson.arguments?.jvm) {
    for (const arg of versionJson.arguments.jvm) {
      if (typeof arg === 'string') {
        jvmArgs.push(substituteTemplate(arg, templateVars))
      } else if (arg?.rules && checkRules(arg.rules)) {
        const values = Array.isArray(arg.value) ? arg.value : [arg.value]
        jvmArgs.push(...values.map((v: string) => substituteTemplate(v, templateVars)))
      }
    }
  } else {
    // Fallback for old format without jvm args
    jvmArgs.push(`-cp`, cp)
  }

  // Game args
  const rawGameArgs: string[] = []
  if (versionJson.arguments?.game) {
    for (const arg of versionJson.arguments.game) {
      if (typeof arg === 'string') {
        rawGameArgs.push(substituteTemplate(arg, templateVars))
      } else if (arg?.rules && checkRules(arg.rules)) {
        const values = Array.isArray(arg.value) ? arg.value : [arg.value]
        rawGameArgs.push(...values.map((v: string) => substituteTemplate(v, templateVars)))
      }
      // args with no rules and no string type are feature-conditional — skip
    }
  } else if (versionJson.minecraftArguments) {
    // Old format (pre-1.13)
    rawGameArgs.push(...versionJson.minecraftArguments.split(' ')
      .map((a: string) => substituteTemplate(a, templateVars)))
  }

  // Drop --flag '' pairs and empty strings (quickplay, clientid, xuid, etc.)
  const gameArgs = filterEmptyArgs(rawGameArgs)

  const mainClass: string = versionJson.mainClass
  const allArgs = [...jvmArgs, mainClass, ...gameArgs]

  console.log('[Launch] java:', javaExe)
  console.log('[Launch] args:', allArgs.join(' '))

  const proc = spawn(javaExe, allArgs, {
    cwd: gameDir,
    detached: false
  })

  proc.stdout?.on('data', (d: Buffer) => {
    win.webContents.send('game:log', d.toString())
  })
  proc.stderr?.on('data', (d: Buffer) => {
    win.webContents.send('game:log', d.toString())
  })
  proc.on('spawn', () => win.webContents.send('game:started'))
  proc.on('close', (code) => win.webContents.send('game:stopped', code))
  proc.on('error', (err) => win.webContents.send('game:log', `[ERROR] ${err.message}`))

  return proc
}
