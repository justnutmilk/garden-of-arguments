import { useState } from 'react'
import type { Match, Person } from '../lib/supabase'
import { search } from '../lib/api'

type Props = {
  personOf: (id: string) => Person | undefined
  titleOf: (argumentId: string) => string
  onResults: (argumentIds: string[]) => void
  onOpenTree: (argumentId: string) => void
  onClose: () => void
}

// Search by meaning, not exact words: "money" also finds "you never pay rent on time".
export function SearchPanel({ personOf, titleOf, onResults, onOpenTree, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Match[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <aside className="clay-card panel">
      <button className="close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <h2>Search</h2>
      <p className="meta">Find arguments by what they were about, even if the words were different.</p>
      <form
        className="search-form row"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!query.trim()) return
          setBusy(true)
          setError(null)
          try {
            const m = await search(query.trim())
            setResults(m)
            onResults([...new Set(m.filter((x) => x.similarity >= 0.78).map((x) => x.argument_id))])
          } catch {
            setError('Search is not working right now. Try again in a moment.')
          } finally {
            setBusy(false)
          }
        }}
      >
        <input
          className="clay-input"
          placeholder="e.g. chores, money, being late"
          value={query}
          maxLength={500}
          autoFocus
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="clay-btn green" disabled={busy || !query.trim()}>
          {busy ? '…' : 'Search'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {results && results.length === 0 && <p className="hint">Nothing yet. Log a few points first.</p>}
      {results?.map((m) => {
        const p = personOf(m.person_id)
        return (
          <button key={m.id} className="result" onClick={() => onOpenTree(m.argument_id)}>
            <span className="dot" style={{ background: p?.color }} />
            <span className="result-text">
              <span>“{m.text.length > 140 ? m.text.slice(0, 137) + '…' : m.text}”</span>
              <small>
                {p?.name} · {titleOf(m.argument_id)}
              </small>
            </span>
            <span className="sim-bar" title={`${Math.round(m.similarity * 100)}% match`}>
              <span style={{ width: `${Math.max(5, Math.min(100, (m.similarity - 0.7) / 0.3 * 100))}%` }} />
            </span>
          </button>
        )
      })}
    </aside>
  )
}
