import { useState, useEffect, useRef, KeyboardEvent } from 'react'

interface Props { onLogout: () => void }

type Tab = 'play' | 'console' | 'skin' | 'settings'

interface JavaInfo { path: string; version: string; managed: boolean }
interface VersionEntry { id: string; type: string; releaseTime: string }
interface Progress { phase: string; current: number; total: number }

const PHASES: Record<string, string> = {
  manifest:      'Получение манифеста...',
  'client-jar':  'Загрузка клиента...',
  libraries:     'Загрузка библиотек...',
  'assets-index':'Загрузка индекса ресурсов...',
  assets:        'Загрузка ресурсов...',
  authlib:       'Загрузка authlib-injector...',
  java:          'Загрузка Java...',
  'java-extract':'Распаковка Java...',
  'java-meta':   'Поиск дистрибутива Java...',
  done:          'Готово!'
}

export default function Home({ onLogout }: Props) {
  const [tab, setTab]               = useState<Tab>('play')
  const [username, setUsername]     = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput]   = useState('')
  const [nameError, setNameError]   = useState<string | null>(null)
  const [java, setJava]             = useState<JavaInfo | null>(null)
  const [javaLoading, setJavaLoad]  = useState(true)
  const [versions, setVersions]     = useState<VersionEntry[]>([])
  const [verLoading, setVerLoading] = useState(false)
  const [selectedVer, setSelectedVer] = useState('1.20.4')
  const [memory, setMemory]         = useState(2048)
  const [progress, setProgress]     = useState<Progress | null>(null)
  const [status, setStatus]         = useState<'idle' | 'downloading' | 'running'>('idle')
  const [logs, setLogs]             = useState<string[]>([])
  const [cfg, setCfg]               = useState<any>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const consoleRef = useRef<HTMLDivElement>(null)

  // Init
  useEffect(() => {
    window.api.config.get().then((c: any) => {
      setCfg(c)
      setUsername(c.username || 'Player')
      setSelectedVer(c.selectedVersion || '1.20.4')
      setMemory(c.memory || 2048)
    })

    // Check Java
    window.api.java.check().then((info: JavaInfo | null) => {
      setJava(info)
      setJavaLoad(false)
    })

    // Subscribe to events
    const offProgress = window.api.on('download:progress', (p: Progress) => setProgress(p))
    const offStarted  = window.api.on('game:started', () => setStatus('running'))
    const offStopped  = window.api.on('game:stopped', () => {
      setStatus('idle')
      setProgress(null)
    })
    const offLog      = window.api.on('game:log', (line: string) => {
      setLogs(prev => [...prev.slice(-500), line])
    })

    return () => { offProgress(); offStarted(); offStopped(); offLog() }
  }, [])

  // Autoscroll console
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // Load versions
  async function loadVersions() {
    setVerLoading(true)
    try {
      const list = await window.api.minecraft.versions()
      setVersions(list)
    } catch {
      // ignore
    } finally {
      setVerLoading(false)
    }
  }

  useEffect(() => { loadVersions() }, [])

  async function installJava() {
    setJavaLoad(true)
    setProgress({ phase: 'java-meta', current: 0, total: 1 })
    try {
      await window.api.java.install()
      const info = await window.api.java.check()
      setJava(info)
    } finally {
      setJavaLoad(false)
      setProgress(null)
    }
  }

  async function handlePlay() {
    if (status === 'running') {
      await window.api.minecraft.kill()
      return
    }

    setStatus('downloading')
    setLogs([])
    setTab('play')

    try {
      await window.api.minecraft.download(selectedVer)
      setProgress(null)

      // Save config
      if (cfg) {
        await window.api.config.set({ ...cfg, selectedVersion: selectedVer, memory })
      }

      await window.api.minecraft.launch({ version: selectedVer, memory })
    } catch (err: any) {
      setStatus('idle')
      setProgress(null)
      alert('Ошибка запуска: ' + (err?.message || err))
    }
  }

  async function handleLogout() {
    await window.api.auth.logout()
    onLogout()
  }

  async function saveCfg(updates: any) {
    const newCfg = { ...cfg, ...updates }
    setCfg(newCfg)
    await window.api.config.set(newCfg)
  }

  function startEditName() {
    setNameInput(username)
    setNameError(null)
    setEditingName(true)
  }

  async function commitName() {
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== username) {
      try {
        const result = await window.api.auth.setUsername(trimmed)
        setUsername(result.username)
        setEditingName(false)
        setNameError(null)
      } catch (err: any) {
        // axios wraps server errors in err.response
        const data = err?.response?.data
        if (data?.error === 'CooldownActive') {
          const h = Math.floor(data.remainsMs / 3600000)
          const m = Math.ceil((data.remainsMs % 3600000) / 60000)
          const label = h > 0 ? `${h} ч ${m} мин` : `${m} мин`
          setNameError(`Смена ника доступна через ${label}`)
        } else {
          setNameError(data?.error || err?.message || 'Ошибка')
        }
        // keep edit mode open so user sees the error
      }
    } else {
      setEditingName(false)
      setNameError(null)
    }
  }

  function handleNameKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitName()
    if (e.key === 'Escape') { setEditingName(false); setNameError(null) }
  }

  const progressPct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0

  const isbusy = status === 'downloading'

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-0)' }}>
      {/* ── Sidebar ── */}
      <div style={{
        width: 200, flexShrink: 0,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: '16px 0'
      }}>
        {/* Player */}
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: 44, height: 44,
            background: 'var(--accent-d)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, marginBottom: 10
          }}>
            🎮
          </div>
          {editingName ? (
            <>
              <input
                autoFocus
                value={nameInput}
                onChange={e => { setNameInput(e.target.value); setNameError(null) }}
                onBlur={commitName}
                onKeyDown={handleNameKey}
                maxLength={16}
                style={{
                  background: 'var(--bg-3)',
                  border: `1px solid ${nameError ? 'var(--red, #e05)' : 'var(--accent)'}`,
                  borderRadius: 6,
                  color: 'var(--text-1)',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '3px 7px',
                  width: '100%',
                  outline: 'none',
                }}
              />
              {nameError && (
                <div style={{ color: 'var(--red, #e05)', fontSize: 10, marginTop: 3, lineHeight: 1.3 }}>
                  {nameError}
                </div>
              )}
            </>
          ) : (
            <div
              onClick={cfg?.authMode === 'custom' ? startEditName : undefined}
              title={cfg?.authMode === 'custom' ? 'Нажмите, чтобы изменить ник' : undefined}
              style={{
                fontWeight: 600, color: 'var(--text-1)', fontSize: 14,
                cursor: cfg?.authMode === 'custom' ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {username}
              {cfg?.authMode === 'custom' && (
                <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>✎</span>
              )}
            </div>
          )}
          <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>Игрок</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([
            ['play',     '▶', 'Играть'],
            ['console',  '>_', 'Консоль'],
            ...(cfg?.authMode === 'custom' ? [['skin', '🎨', 'Скин']] : []),
            ['settings', '⚙', 'Настройки']
          ] as [Tab, string, string][]).map(([t, icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 'var(--radius)',
                background: tab === t ? 'var(--bg-3)' : 'transparent',
                color: tab === t ? 'var(--text-1)' : 'var(--text-2)',
                border: tab === t ? '1px solid var(--border)' : '1px solid transparent',
                fontWeight: tab === t ? 600 : 400,
                fontSize: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
                transition: 'all 0.1s'
              }}
            >
              <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div style={{ padding: '0 8px', borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', width: '100%', borderRadius: 'var(--radius)',
              background: 'transparent', border: 'none',
              color: 'var(--text-3)', fontSize: 13, cursor: 'pointer',
              transition: 'color 0.1s'
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}
          >
            <span>⏻</span> Выйти
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ── Play tab ── */}
        {tab === 'play' && (
          <div style={{ flex: 1, padding: 28, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Запустить игру</div>
              <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Выберите версию и нажмите Play</div>
            </div>

            {/* Java status */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {javaLoading ? (
                <div className="spinner" />
              ) : java ? (
                <>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(34,197,94,.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                  }}>☕</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Java {java.version}</div>
                    <div style={{ color: 'var(--text-2)', fontSize: 11 }}>
                      {java.managed ? 'Управляемая установка' : java.path}
                    </div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 99,
                      background: 'rgba(34,197,94,.15)', color: 'var(--accent)',
                      fontSize: 11, fontWeight: 600
                    }}>✓ Готово</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(239,68,68,.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                  }}>☕</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Java не найдена</div>
                    <div style={{ color: 'var(--text-2)', fontSize: 11 }}>Необходима для запуска Minecraft</div>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', padding: '6px 14px', fontSize: 12 }}
                      onClick={installJava}
                      disabled={javaLoading}
                    >
                      Установить Java 21
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Version selector */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontWeight: 600 }}>Версия Minecraft</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <select
                  value={selectedVer}
                  onChange={e => setSelectedVer(e.target.value)}
                  disabled={isbusy || status === 'running' || verLoading}
                >
                  {versions.length === 0 && (
                    <option value={selectedVer}>{selectedVer}</option>
                  )}
                  {versions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.id} {v.type === 'snapshot' ? '(snapshot)' : ''}
                    </option>
                  ))}
                </select>
                {verLoading && <div className="spinner" style={{ flexShrink: 0 }} />}
              </div>

              {/* Memory */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ textTransform: 'none', fontSize: 13, marginBottom: 0 }}>Память</label>
                  <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>{memory} МБ</span>
                </div>
                <input
                  type="range"
                  min={512} max={8192} step={256}
                  value={memory}
                  onChange={e => setMemory(+e.target.value)}
                  disabled={isbusy || status === 'running'}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-3)', fontSize: 11, marginTop: 4 }}>
                  <span>512 МБ</span><span>8192 МБ</span>
                </div>
              </div>
            </div>

            {/* Progress */}
            {progress && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span>{PHASES[progress.phase] || progress.phase}</span>
                  {progress.total > 0 && (
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{progressPct}%</span>
                  )}
                </div>
                <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: progress.total > 0 ? `${progressPct}%` : '100%',
                    background: 'var(--accent)',
                    borderRadius: 3,
                    transition: 'width 0.2s',
                    animation: progress.total === 0 ? 'pulse 1s ease-in-out infinite' : 'none'
                  }} />
                </div>
                {progress.phase === 'libraries' && progress.total > 0 && (
                  <div style={{ color: 'var(--text-2)', fontSize: 11 }}>
                    Библиотека {progress.current} / {progress.total}
                  </div>
                )}
                {progress.phase === 'assets' && progress.total > 0 && (
                  <div style={{ color: 'var(--text-2)', fontSize: 11 }}>
                    Ресурс {progress.current} / {progress.total}
                  </div>
                )}
              </div>
            )}

            {/* Play button */}
            <button
              onClick={handlePlay}
              disabled={!java || javaLoading || isbusy}
              style={{
                height: 52, fontSize: 16, fontWeight: 700,
                background: status === 'running' ? 'var(--danger)' : 'var(--accent)',
                color: status === 'running' ? '#fff' : '#000',
                borderRadius: 'var(--radius-lg)',
                border: 'none', cursor: 'pointer',
                transition: 'background 0.15s, transform 0.1s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
              }}
            >
              {isbusy
                ? <><div className="spinner" style={{ borderTopColor: '#000' }} /> Загрузка...</>
                : status === 'running'
                  ? '■ Остановить'
                  : '▶ Играть'}
            </button>
          </div>
        )}

        {/* ── Console tab ── */}
        {tab === 'console' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontWeight: 600 }}>Консоль игры</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn-ghost"
                  style={{ width: 'auto', fontSize: 12 }}
                  onClick={() => {
                    const text = logs.join('')
                    if (text) navigator.clipboard.writeText(text)
                  }}
                >
                  Копировать
                </button>
                <button
                  className="btn-ghost"
                  style={{
                    width: 'auto', fontSize: 12,
                    color: autoScroll ? 'var(--accent)' : 'var(--text-3)',
                    borderColor: autoScroll ? 'var(--accent)' : undefined
                  }}
                  onClick={() => setAutoScroll(v => !v)}
                  title="Авто-прокрутка к концу"
                >
                  ↓ Авто
                </button>
                <button
                  className="btn-ghost"
                  style={{ width: 'auto', fontSize: 12 }}
                  onClick={() => setLogs([])}
                >
                  Очистить
                </button>
              </div>
            </div>
            <div
              ref={consoleRef}
              style={{
                flex: 1, overflow: 'auto',
                background: 'var(--bg-1)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 12,
                fontFamily: '"Cascadia Code", "Fira Code", monospace',
                fontSize: 11.5,
                lineHeight: 1.6,
                color: 'var(--text-2)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                userSelect: 'text',
                cursor: 'text',
              }}
            >
              {logs.length === 0
                ? <span style={{ color: 'var(--text-3)', userSelect: 'none' }}>Запустите игру, чтобы увидеть вывод...</span>
                : logs.map((line, i) => <span key={i}>{line}</span>)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Строк: {logs.length} {status === 'running' && '• ● Игра запущена'}
            </div>
          </div>
        )}

        {/* ── Skin tab ── */}
        {tab === 'skin' && <SkinTab cfg={cfg} />}

        {/* ── Settings tab ── */}
        {tab === 'settings' && cfg && (
          <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Настройки</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Сервер авторизации</div>
                <div>
                  <label>URL сервера</label>
                  <input
                    type="text"
                    value={cfg.authServerUrl}
                    onChange={e => saveCfg({ authServerUrl: e.target.value })}
                    placeholder="http://localhost:3000"
                  />
                  <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 6 }}>
                    Адрес вашего auth-сервера. Изменение применится при следующем входе.
                  </div>
                </div>
              </div>

              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Директории</div>
                <div>
                  <label>Папка игры</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={cfg.gameDir}
                      onChange={e => saveCfg({ gameDir: e.target.value })}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-secondary"
                      style={{ width: 'auto', padding: '0 14px', fontSize: 12 }}
                      onClick={() => window.api.shell.openDir(cfg.gameDir)}
                    >
                      Открыть
                    </button>
                  </div>
                </div>
                <div>
                  <label>Java (путь к java.exe)</label>
                  <input
                    type="text"
                    value={cfg.javaPath}
                    onChange={e => saveCfg({ javaPath: e.target.value })}
                    placeholder="Авто-определение"
                  />
                </div>
              </div>

              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>О лаунчере</div>
                <div style={{ color: 'var(--text-2)', fontSize: 13, lineHeight: 1.7 }}>
                  <div>Версия лаунчера: <strong style={{ color: 'var(--text-1)' }}>1.0.0</strong></div>
                  <div>Авторизация: <strong style={{ color: 'var(--text-1)' }}>Yggdrasil (кастомный сервер)</strong></div>
                  <div>Пользователь: <strong style={{ color: 'var(--accent)' }}>{username}</strong></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Skin tab component ───────────────────────────────────────────────────────

function SkinTab({ cfg }: { cfg: any }) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [model, setModel]               = useState<'classic' | 'slim'>('classic')
  const [uploading, setUploading]       = useState(false)
  const [msg, setMsg]                   = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [skinTs, setSkinTs]             = useState(Date.now())
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const viewerRef  = useRef<any>(null)

  const email = cfg?.email || ''
  const serverSkinUrl = email
    ? `${cfg?.authServerUrl}/skins/${encodeURIComponent(email)}.png?t=${skinTs}`
    : null

  const baseUrl      = cfg?.authServerUrl || 'http://localhost:3000'
  const defaultSkinUrl = `${baseUrl}/skins/default.png`

  // Resolve which skin URL to load: user-specific (may 404) → default → nothing
  async function resolveSkinUrl(): Promise<string | null> {
    const candidates = [serverSkinUrl, defaultSkinUrl].filter(Boolean) as string[]
    for (const url of candidates) {
      try {
        const r = await fetch(url, { method: 'HEAD' })
        if (r.ok) return url
      } catch { /* ignore */ }
    }
    return null
  }

  // Load skin into viewer, with full fallback chain
  async function reloadViewer(v: any, file?: string | null) {
    if (file) {
      try {
        const dataUrl = await window.api.dialog.readDataUrl(file)
        await v.loadSkin(dataUrl)
        return
      } catch { /* fall through */ }
    }
    const url = await resolveSkinUrl()
    if (url) v.loadSkin(url).catch(() => {})
  }

  // ── Init 3D viewer once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return
    let disposed = false

    import('skinview3d').then(async (sv3d) => {
      if (disposed || !canvasRef.current) return

      const viewer = new sv3d.SkinViewer({
        canvas: canvasRef.current,
        width:  160,
        height: 280,
      })

      viewer.controls.enableRotate = true
      viewer.controls.enableZoom   = false
      viewer.controls.enablePan    = false
      viewer.autoRotate            = true
      viewer.autoRotateSpeed       = 0.8
      viewer.animation             = new sv3d.WalkingAnimation()
      viewer.fov                   = 70
      viewer.zoom                  = 0.9

      viewerRef.current = { viewer, sv3d }

      // Load skin immediately after viewer is ready
      await reloadViewer(viewer)
    })

    return () => {
      disposed = true
      viewerRef.current?.viewer?.dispose()
      viewerRef.current = null
    }
  }, []) // eslint-disable-line

  // ── Reload skin when file selection or server skin changes ───────────────────
  useEffect(() => {
    const v = viewerRef.current?.viewer
    if (!v) return
    reloadViewer(v, selectedFile)
  }, [selectedFile, skinTs]) // eslint-disable-line

  // ── Sync slim model ──────────────────────────────────────────────────────────
  useEffect(() => {
    const v = viewerRef.current?.viewer
    if (!v) return
    v.playerObject.skin.slim = model === 'slim'
  }, [model])

  if (!cfg) return null

  async function pickFile() {
    const filePath = await window.api.dialog.openFile([
      { name: 'PNG Image', extensions: ['png'] }
    ])
    if (!filePath) return
    setSelectedFile(filePath)
    setMsg(null)
  }

  async function upload() {
    if (!selectedFile) return
    setUploading(true)
    setMsg(null)
    try {
      await window.api.skin.upload(selectedFile, model)
      setMsg({ type: 'success', text: 'Скин успешно загружен!' })
      setSelectedFile(null)
      setSkinTs(Date.now())
    } catch (err: any) {
      const text = err?.response?.data?.error || err?.message || 'Ошибка загрузки'
      setMsg({ type: 'error', text })
    } finally {
      setUploading(false)
    }
  }

  async function removeSkin() {
    setUploading(true)
    setMsg(null)
    try {
      await window.api.skin.delete()
      setMsg({ type: 'success', text: 'Скин сброшен' })
      setSkinTs(Date.now())
      setSelectedFile(null)
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Ошибка' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Скин</div>
      <div style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 24 }}>
        Загрузите PNG 64×64 или 64×32 — он отобразится в игре
      </div>

      <div style={{ display: 'flex', gap: 28, maxWidth: 680, flexWrap: 'wrap' }}>

        {/* ── 3D Viewer ── */}
        <div style={{
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
        }}>
          <div style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            overflow: 'hidden',
            cursor: 'grab',
          }}>
            <canvas
              ref={canvasRef}
              style={{ display: 'block' }}
            />
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 10, textAlign: 'center' }}>
            Перетащите чтобы повернуть
          </div>
        </div>

        {/* ── Controls ── */}
        <div style={{ flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* File picker */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 600 }}>Выбор файла</div>
            <div style={{
              padding: '10px 14px',
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: selectedFile ? 'var(--accent)' : 'var(--text-3)',
              fontSize: 12, fontFamily: 'monospace',
              wordBreak: 'break-all'
            }}>
              {selectedFile ? selectedFile.split(/[\\/]/).pop() : 'Файл не выбран'}
            </div>
            <button
              className="btn-secondary"
              style={{ width: 'auto', alignSelf: 'flex-start' }}
              onClick={pickFile}
              disabled={uploading}
            >
              📂 Выбрать PNG
            </button>
          </div>

          {/* Model selector */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontWeight: 600 }}>Тип модели</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {(['classic', 'slim'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  style={{
                    flex: 1, padding: '9px',
                    borderRadius: 'var(--radius)',
                    border: model === m ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: model === m ? 'rgba(34,197,94,.1)' : 'var(--bg-3)',
                    color: model === m ? 'var(--accent)' : 'var(--text-2)',
                    fontWeight: model === m ? 600 : 400,
                    cursor: 'pointer', fontSize: 13
                  }}
                >
                  {m === 'classic' ? '🟫 Классик' : '📐 Slim'}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          {msg && (
            <div className={`msg msg-${msg.type === 'error' ? 'error' : 'success'}`}>
              {msg.text}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn-primary"
              style={{ flex: 2 }}
              onClick={upload}
              disabled={!selectedFile || uploading}
            >
              {uploading
                ? <><div className="spinner" style={{ borderTopColor: '#000' }} /> Загрузка...</>
                : '⬆ Загрузить скин'}
            </button>
            <button
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={removeSkin}
              disabled={uploading}
            >
              🗑 Сброс
            </button>
          </div>

          <div style={{ color: 'var(--text-3)', fontSize: 11, lineHeight: 1.7 }}>
            Скин отобразится при следующем входе в игру.<br />
            Требования: PNG, 64×64 px, макс. 1 МБ.
          </div>
        </div>
      </div>
    </div>
  )
}
