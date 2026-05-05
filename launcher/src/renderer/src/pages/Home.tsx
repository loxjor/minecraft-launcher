import { useState, useEffect, useRef } from 'react'

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
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs])

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
          <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 14 }}>{username}</div>
          <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>Игрок</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([
            ['play',     '▶', 'Играть'],
            ['console',  '▣', 'Консоль'],
            ['skin',     '🎨', 'Скин'],
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 600 }}>Консоль игры</div>
              <button
                className="btn-ghost"
                style={{ width: 'auto', fontSize: 12 }}
                onClick={() => setLogs([])}
              >
                Очистить
              </button>
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
                wordBreak: 'break-all'
              }}
            >
              {logs.length === 0
                ? <span style={{ color: 'var(--text-3)' }}>Запустите игру, чтобы увидеть вывод...</span>
                : logs.join('')}
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
  const [preview, setPreview]           = useState<string | null>(null)
  const [model, setModel]               = useState<'classic' | 'slim'>('classic')
  const [uploading, setUploading]       = useState(false)
  const [msg, setMsg]                   = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [skinTs, setSkinTs]             = useState(Date.now())  // cache-bust

  if (!cfg) return null

  const uuidNoDashes = (cfg.uuid || '').replace(/-/g, '')
  const serverSkinUrl = uuidNoDashes
    ? `${cfg.authServerUrl}/skins/${uuidNoDashes}.png?t=${skinTs}`
    : null

  async function pickFile() {
    const filePath = await window.api.dialog.openFile([
      { name: 'PNG Image', extensions: ['png'] }
    ])
    if (!filePath) return

    setSelectedFile(filePath)
    setMsg(null)

    // Read file as data URL for local preview
    // We use IPC trick: ask main to convert to base64, then display
    try {
      // Use fetch with file:// URL trick — won't work in Electron renderer directly.
      // Instead we'll just show the file path and let the user know it's selected.
      setPreview(null)  // reset server preview to show pending state
    } catch {
      // ignore
    }
  }

  async function upload() {
    if (!selectedFile) return
    setUploading(true)
    setMsg(null)
    try {
      await window.api.skin.upload(selectedFile, model)
      setMsg({ type: 'success', text: 'Скин успешно загружен!' })
      setSelectedFile(null)
      setSkinTs(Date.now())  // refresh preview
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

      <div style={{ display: 'flex', gap: 28, maxWidth: 620, flexWrap: 'wrap' }}>

        {/* Preview */}
        <div style={{
          width: 160, flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12
        }}>
          <div style={{
            width: 120, height: 120,
            background: 'var(--bg-2)',
            border: '2px dashed var(--border)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
            imageRendering: 'pixelated' as any
          }}>
            {serverSkinUrl ? (
              <img
                src={serverSkinUrl}
                alt="skin"
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'contain',
                  imageRendering: 'pixelated'
                }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <span style={{ fontSize: 40 }}>👤</span>
            )}
          </div>
          <div style={{ color: 'var(--text-3)', fontSize: 11, textAlign: 'center' }}>
            Текущий скин на сервере
          </div>
        </div>

        {/* Controls */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* File picker */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontWeight: 600 }}>Выбор файла</div>

            <div style={{
              padding: '10px 14px',
              background: 'var(--bg-3)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: selectedFile ? 'var(--text-1)' : 'var(--text-3)',
              fontSize: 12, fontFamily: 'monospace',
              wordBreak: 'break-all'
            }}>
              {selectedFile
                ? selectedFile.split(/[\\/]/).pop()
                : 'Файл не выбран'}
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
                  {m === 'classic' ? '🟫 Классический (4px руки)' : '📐 Тонкий (3px руки)'}
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
              {uploading ? <><div className="spinner" style={{ borderTopColor: '#000' }} /> Загрузка...</> : '⬆ Загрузить скин'}
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

          <div style={{ color: 'var(--text-3)', fontSize: 11, lineHeight: 1.6 }}>
            Скин отобразится при следующем входе в игру.<br />
            Требования: PNG, 64×64 px, макс. 1 МБ.
          </div>
        </div>
      </div>
    </div>
  )
}
