import { useState } from 'react'

interface Props {
  onLogin: () => void
  onRegister: () => void
}

export default function Login({ onLogin, onRegister }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

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
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>⛏</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)' }}>MC Launcher</div>
          <div style={{ color: 'var(--text-2)', marginTop: 4 }}>Войдите в аккаунт</div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label>Логин или Email</label>
            <input
              type="text"
              placeholder="Введите логин"
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

        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-2)', fontSize: 13 }}>
          Нет аккаунта?{' '}
          <button className="link" onClick={onRegister}>Зарегистрироваться</button>
        </div>

        {/* Auth server hint */}
        <AuthServerBadge />
      </div>
    </div>
  )
}

function AuthServerBadge() {
  const [url, setUrl] = useState('')
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  useState(() => {
    window.api.config.get().then((cfg: any) => setUrl(cfg.authServerUrl))
  })

  async function save() {
    const cfg = await window.api.config.get()
    await window.api.config.set({ ...cfg, authServerUrl: url })
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{
      marginTop: 28, padding: '12px 16px',
      background: 'var(--bg-2)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', fontSize: 12
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editing ? 8 : 0 }}>
        <span style={{ color: 'var(--text-3)' }}>Сервер авторизации</span>
        <button className="link" style={{ fontSize: 12 }} onClick={() => setEditing(!editing)}>
          {editing ? 'Отмена' : 'Изменить'}
        </button>
      </div>

      {editing ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            style={{ fontSize: 12, padding: '6px 10px' }}
          />
          <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, width: 'auto' }} onClick={save}>
            ОК
          </button>
        </div>
      ) : (
        <div style={{ color: saved ? 'var(--accent)' : 'var(--text-2)', marginTop: 2 }}>
          {saved ? '✓ Сохранено' : url}
        </div>
      )}
    </div>
  )
}
