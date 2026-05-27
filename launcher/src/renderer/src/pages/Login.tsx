import { useState, useEffect } from 'react'

interface Props {
  onLogin: () => void
  onRegister: () => void
}

type AuthMode = 'custom' | 'ely' | 'mojang'

const MODES: { id: AuthMode; label: string; hint: string }[] = [
  { id: 'custom', label: 'Свой сервер', hint: 'Авторизация через mc-auth-server' },
  { id: 'ely',    label: 'Ely.by',      hint: 'Сервис авторизации ely.by' },
  { id: 'mojang', label: 'Mojang',      hint: 'Официальная Mojang-авторизация' }
]

export default function Login({ onLogin, onRegister }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [mode, setMode]         = useState<AuthMode>('custom')
  const [serverUrl, setServerUrl] = useState('')
  const [editingUrl, setEditingUrl] = useState(false)

  useEffect(() => {
    window.api.config.get().then((cfg: any) => {
      setMode(cfg.authMode || 'custom')
      setServerUrl(cfg.authServerUrl || '')
    })
  }, [])

  async function selectMode(m: AuthMode) {
    setMode(m)
    setError('')
    const cfg = await window.api.config.get()
    await window.api.config.set({ ...cfg, authMode: m })
  }

  async function saveUrl() {
    const cfg = await window.api.config.get()
    await window.api.config.set({ ...cfg, authServerUrl: serverUrl })
    setEditingUrl(false)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      await window.api.auth.login(username.trim(), password)
      onLogin()
    } catch (err: any) {
      const msg = err?.response?.data?.errorMessage
        || err?.response?.data?.error
        || err?.message
        || 'Ошибка входа'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,.06) 0%, transparent 65%), var(--bg-0)'
    }}>
      <div style={{ width: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>⛏</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)' }}>MC Launcher</div>
          <div style={{ color: 'var(--text-2)', marginTop: 4 }}>Войдите в аккаунт</div>
        </div>

        {/* Mode selector */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 20,
          background: 'var(--bg-2)', borderRadius: 'var(--radius)',
          padding: 4, border: '1px solid var(--border)'
        }}>
          {MODES.map(m => (
            <button
              key={m.id}
              onClick={() => selectMode(m.id)}
              style={{
                flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
                borderRadius: 6, border: 'none', cursor: 'pointer',
                background: mode === m.id ? 'var(--accent)' : 'transparent',
                color: mode === m.id ? '#fff' : 'var(--text-2)',
                transition: 'all .15s'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Custom server URL */}
        {mode === 'custom' && (
          <div style={{
            marginBottom: 16, padding: '10px 14px',
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', fontSize: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editingUrl ? 8 : 0 }}>
              <span style={{ color: 'var(--text-3)' }}>Адрес сервера</span>
              <button className="link" style={{ fontSize: 12 }} onClick={() => setEditingUrl(v => !v)}>
                {editingUrl ? 'Отмена' : 'Изменить'}
              </button>
            </div>
            {editingUrl ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={e => setServerUrl(e.target.value)}
                  style={{ fontSize: 12, padding: '6px 10px' }}
                />
                <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, width: 'auto' }} onClick={saveUrl}>
                  ОК
                </button>
              </div>
            ) : (
              <div style={{ color: 'var(--text-2)', marginTop: 2 }}>{serverUrl}</div>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label>{mode === 'custom' ? 'Логин или Email' : 'Email'}</label>
            <input
              type="text"
              placeholder={mode === 'custom' ? 'Введите логин' : 'Введите email'}
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              disabled={loading}
            />
          </div>

          <div>
            <label>Пароль</label>
            <input
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && <div className="msg msg-error">{error}</div>}

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: 4, height: 44 }}
            disabled={loading || !username.trim() || !password}
          >
            {loading ? <><div className="spinner" /> Вход...</> : 'Войти'}
          </button>
        </form>

        {mode === 'custom' && (
          <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-2)', fontSize: 13 }}>
            Нет аккаунта?{' '}
            <button className="link" onClick={onRegister}>Зарегистрироваться</button>
          </div>
        )}
      </div>
    </div>
  )
}
