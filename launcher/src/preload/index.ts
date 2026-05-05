import { contextBridge, ipcRenderer } from 'electron'

export type ProgressEvent = { phase: string; current: number; total: number }

const api = {
  // Window controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close')
  },

  // Config
  config: {
    get: ()           => ipcRenderer.invoke('config:get'),
    set: (cfg: any)   => ipcRenderer.invoke('config:set', cfg)
  },

  // Auth
  auth: {
    register: (username: string, email: string, password: string) =>
      ipcRenderer.invoke('auth:register', username, email, password),
    login: (username: string, password: string) =>
      ipcRenderer.invoke('auth:login', username, password),
    logout: () =>
      ipcRenderer.invoke('auth:logout'),
    validate: () =>
      ipcRenderer.invoke('auth:validate')
  },

  // Java
  java: {
    check:   ()  => ipcRenderer.invoke('java:check'),
    install: ()  => ipcRenderer.invoke('java:install')
  },

  // Minecraft
  minecraft: {
    versions: ()                            => ipcRenderer.invoke('minecraft:versions'),
    download: (version: string)             => ipcRenderer.invoke('minecraft:download', version),
    launch:   (opts: { version: string; memory: number }) =>
                                               ipcRenderer.invoke('minecraft:launch', opts),
    kill:     ()                            => ipcRenderer.invoke('minecraft:kill')
  },

  // Shell
  shell: {
    openDir: (dir: string) => ipcRenderer.invoke('shell:openDir', dir)
  },

  // File dialog
  dialog: {
    openFile: (filters: { name: string; extensions: string[] }[]) =>
      ipcRenderer.invoke('dialog:openFile', filters)
  },

  // Skin
  skin: {
    upload: (filePath: string, model: string) => ipcRenderer.invoke('skin:upload', filePath, model),
    delete: () => ipcRenderer.invoke('skin:delete')
  },

  // Events
  on: (channel: string, cb: (...args: any[]) => void) => {
    const handler = (_: Electron.IpcRendererEvent, ...args: any[]) => cb(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  once: (channel: string, cb: (...args: any[]) => void) => {
    ipcRenderer.once(channel, (_: Electron.IpcRendererEvent, ...args: any[]) => cb(...args))
  }
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
