import { useState } from 'react'
import type { AuthResponse, AuthTokenResponsePassword } from '@supabase/supabase-js'

interface AuthScreenProps {
  signIn: (email: string, password: string) => Promise<AuthTokenResponsePassword>
  signUp: (email: string, password: string) => Promise<AuthResponse>
}

export function AuthScreen({ signIn, signUp }: AuthScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
      } else {
        const { data, error } = await signUp(email, password)
        if (error) setError(error.message)
        else if (!data.session) setInfo('Check your email to confirm your account, then sign in.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="centered-screen">
      <form className="auth-card" onSubmit={submit}>
        <h1>🗺️ Where I've Been</h1>
        <p className="muted">Sign in to load your map.</p>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} required onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            required
            minLength={6}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {info && <p className="info">{info}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="link"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'First time? Create an account' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
