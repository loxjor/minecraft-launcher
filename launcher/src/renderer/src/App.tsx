import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'

type Page = 'loading' | 'login' | 'register' | 'home'

declare global {
  interface Window { api: any }
}

// Custom title bar
function TitleBar() {
  return (
    <div className="titlebar">
      <div className="titlebar-title">
        <span style={{ fontSize: 18 }}>⛏</span>
        MC Launcher
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-btn" onClick={() => window.api.window.minimize()} title="Свернуть">─</button>
        <button className="titlebar-btn" onClick={() => window.api.window.maximize()} title="Развернуть">□</button>
        <button className="titlebar-btn close" onClick={() => window.api.window.close()} title="Закрыть">✕</button>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>('loading')

  useEffect(() => {
    window.api.auth.validate().then((valid: boolean) => {
      setPage(valid ? 'home' : 'login')
    }).catch(() => setPage('login'))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TitleBar />

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {page === 'loading' && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', flexDirection: 'column', gap: 16
          }}>
            <span style={{ fontSize: 48 }}>⛏</span>
            <div className="spinner" style={{ width: 24, height: 24 }} />
          </div>
        )}

        {page === 'login' && (
          <Login
            onLogin={() => setPage('home')}
            onRegister={() => setPage('register')}
          />
        )}

        {page === 'register' && (
          <Register
            onBack={() => setPage('login')}
            onRegistered={() => setPage('login')}
          />
        )}

        {page === 'home' && (
          <Home onLogout={() => setPage('login')} />
        )}
      </div>
    </div>
  )
}
