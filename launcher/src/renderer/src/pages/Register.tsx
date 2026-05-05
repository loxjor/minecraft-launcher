import { useState } from 'react'

interface Props {
  onBack: () => void
  onRegistered: () => void
}

export default function Register({ onBack, onRegistered }: Props) {
  const [form, setForm]       = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  function set(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      return setError('Пароли не совпадают')
    }
    setLoading(true)
    setError('')
    try {
      await window.api.auth.register(form.username.trim(), form.email.trim(), form.password)
      setSuccess(true)
      setTimeout(onRegistered, 2000)
    } catch (err: any) {
      const msg = err?.response?.data?.error
        || err?.message
        || 'Ошибка регистрации'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const valid = form.username.length >= 3
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    && form.password.length >= 6
    && form.password === form.confirm

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,.06) 0%, transparent 65%), var(--bg-0)'
    }}>
      <div style={{ width: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⛏</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Регистрация</div>
          <div style={{ color: 'var(--text-2)', marginTop: 4, fontSize: 13 }}>Создайте аккаунт</div>
        </div>

        {success ? (
          <div className="msg msg-success" style={{ textAlign: 'center', padding: 20 }}>
            ✓ Аккаунт создан! Перенаправление...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label>Никнейм (3–16 символов)</label>
              <input
                type="text"
                placeholder="SteveBuilder"
                value={form.username}
                onChange={e => set('username', e.target.value)}
                maxLength={16}
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label>Пароль (мин. 6 символов)</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label>Подтверждение пароля</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.confirm}
                onChange={e => set('confirm', e.target.value)}
                disabled={loading}
              />
              {form.confirm && form.password !== form.confirm && (
                <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>
                  Пароли не совпадают
                </div>
              )}
            </div>

            {error && <div className="msg msg-error">{error}</div>}

            <button
              type="submit"
              className="btn-primary"
              style={{ height: 44, marginTop: 4 }}
              disabled={loading || !valid}
            >
              {loading ? <><div className="spinner" /> Регистрация...</> : 'Создать аккаунт'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text-2)', fontSize: 13 }}>
          <button className="link" onClick={onBack}>← Назад к входу</button>
        </div>
      </div>
    </div>
  )
}
