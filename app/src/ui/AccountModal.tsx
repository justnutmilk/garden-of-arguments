import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { continueWithGoogle, saveWithEmail, signInWithEmail, signOut } from '../lib/auth'

type Props = { user: User; treeCount: number; onClose: () => void; onDone: (msg: string) => void }

export function AccountModal({ user, treeCount, onClose, onDone }: Props) {
  const anonymous = !!user.is_anonymous
  const [tab, setTab] = useState<'save' | 'signin'>(anonymous ? 'save' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<void>, msg: string) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone(msg)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (!anonymous) {
    return (
      <div className="clay-card modal">
        <button className="close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <h2>Your account</h2>
        <p>
          Signed in as <b>{user.email || 'Google account'}</b>. Your garden is saved and you can open it on any device.
        </p>
        <div className="row end">
          <button className="clay-btn ghost" onClick={onClose}>
            Close
          </button>
          <button className="clay-btn red" disabled={busy} onClick={() => run(signOut, 'Signed out')}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="clay-card modal">
      <button className="close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <h2>Keep your garden</h2>
      <p className="meta">Right now your garden only lives on this device. Save it to open it anywhere.</p>

      <div className="tabs">
        <button className={'tab' + (tab === 'save' ? ' on' : '')} onClick={() => setTab('save')}>
          Save my garden
        </button>
        <button className={'tab' + (tab === 'signin' ? ' on' : '')} onClick={() => setTab('signin')}>
          I already have one
        </button>
      </div>

      <button className="clay-btn google-btn" disabled={busy} onClick={() => run(() => continueWithGoogle(true), 'Opening Google…')}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        Continue with Google
      </button>

      <div className="divider">or</div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (tab === 'save') run(() => saveWithEmail(email.trim(), password), 'Saved! Your garden is now yours on any device.')
          else run(() => signInWithEmail(email.trim(), password), 'Welcome back!')
        }}
      >
        <label className="field">
          <span>Email</span>
          <input className="clay-input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password {tab === 'save' && <small>(8 or more characters)</small>}</span>
          <input
            className="clay-input"
            type="password"
            autoComplete={tab === 'save' ? 'new-password' : 'current-password'}
            minLength={tab === 'save' ? 8 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {tab === 'signin' && treeCount > 0 && (
          <p className="hint">The {treeCount} tree{treeCount === 1 ? '' : 's'} on this device won't come with you. Save them first if you want to keep them.</p>
        )}
        {error && <p className="error">{error}</p>}
        <div className="row end">
          <button className="clay-btn green big" disabled={busy}>
            {busy ? '…' : tab === 'save' ? 'Save' : 'Sign in'}
          </button>
        </div>
      </form>
    </div>
  )
}
