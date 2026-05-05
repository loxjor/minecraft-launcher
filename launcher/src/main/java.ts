import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import axios from 'axios'
import AdmZip from 'adm-zip'
import { BrowserWindow } from 'electron'

const ADOPTIUM_API = 'https://api.adoptium.net/v3/assets/latest/21/hotspot'
  + '?architecture=x64&image_type=jre&os=windows&vendor=eclipse'

export interface JavaInfo {
  path: string
  version: string
  managed: boolean
}

export async function findJava(javaDir: string, configuredPath: string): Promise<JavaInfo | null> {
  // 1. Check managed Java installation
  const managedExe = path.join(javaDir, 'bin', 'java.exe')
  if (fs.existsSync(managedExe)) {
    const version = getJavaVersion(managedExe)
    if (version) return { path: managedExe, version, managed: true }
  }

  // 2. Check configured path
  if (configuredPath && fs.existsSync(configuredPath)) {
    const version = getJavaVersion(configuredPath)
    if (version) return { path: configuredPath, version, managed: false }
  }

  // 3. Check JAVA_HOME
  const javaHome = process.env.JAVA_HOME
  if (javaHome) {
    const exe = path.join(javaHome, 'bin', 'java.exe')
    if (fs.existsSync(exe)) {
      const version = getJavaVersion(exe)
      if (version) return { path: exe, version, managed: false }
    }
  }

  // 4. Check system PATH
  try {
    const exe = execSync('where java', { encoding: 'utf-8' }).trim().split('\n')[0].trim()
    if (exe) {
      const version = getJavaVersion(exe)
      if (version) return { path: exe, version, managed: false }
    }
  } catch {
    // java not in PATH
  }

  return null
}

function getJavaVersion(javaExe: string): string | null {
  try {
    const out = execSync(`"${javaExe}" -version 2>&1`, { encoding: 'utf-8', timeout: 5000 })
    const match = out.match(/version "([^"]+)"/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

export async function downloadJava(
  javaDir: string,
  win: BrowserWindow
): Promise<string> {
  win.webContents.send('download:progress', { phase: 'java-meta', current: 0, total: 1 })

  const metaRes = await axios.get(ADOPTIUM_API, { timeout: 15000 })
  const asset = metaRes.data[0]
  if (!asset) throw new Error('No Java release found from Adoptium')

  const pkg = asset.binary.package
  const downloadUrl: string = pkg.link
  const fileName: string = pkg.name            // e.g. OpenJDK21U-jre_x64_windows_hotspot_21.0.2_13.zip
  const totalSize: number = pkg.size

  const tmpZip = path.join(javaDir, '..', fileName)
  fs.mkdirSync(path.dirname(tmpZip), { recursive: true })

  win.webContents.send('download:progress', { phase: 'java', current: 0, total: totalSize })

  // Download
  const response = await axios.get(downloadUrl, { responseType: 'stream', timeout: 120000 })
  let downloaded = 0

  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(tmpZip)
    response.data.on('data', (chunk: Buffer) => {
      downloaded += chunk.length
      win.webContents.send('download:progress', { phase: 'java', current: downloaded, total: totalSize })
    })
    response.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
  })

  // Extract
  win.webContents.send('download:progress', { phase: 'java-extract', current: 0, total: 1 })

  if (fs.existsSync(javaDir)) fs.rmSync(javaDir, { recursive: true, force: true })
  fs.mkdirSync(javaDir, { recursive: true })

  const zip = new AdmZip(tmpZip)
  const entries = zip.getEntries()
  // The zip has a top-level folder like "jdk-21.0.2+13-jre"
  const topFolder = entries[0]?.entryName.split('/')[0] || ''

  zip.extractAllTo(javaDir, true)

  // Move contents of top folder up one level
  const extracted = path.join(javaDir, topFolder)
  if (fs.existsSync(extracted)) {
    for (const item of fs.readdirSync(extracted)) {
      fs.renameSync(path.join(extracted, item), path.join(javaDir, item))
    }
    fs.rmdirSync(extracted)
  }

  fs.unlinkSync(tmpZip)

  const javaExe = path.join(javaDir, 'bin', 'java.exe')
  win.webContents.send('download:progress', { phase: 'java-done', current: 1, total: 1 })
  return javaExe
}
