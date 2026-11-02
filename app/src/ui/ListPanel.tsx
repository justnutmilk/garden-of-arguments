import { useState } from 'react'
import type { Argument, Person } from '../lib/supabase'

type Props = {
  trees: Argument[]
  peopleFor: (argumentId: string) => Person[]
  countFor: (argumentId: string) => number
  onOpenTree: (argumentId: string) => void
  onClose: () => void
}

export function ListPanel({ trees, peopleFor, countFor, onOpenTree, onClose }: Props) {
  const [tab, setTab] = useState<'open' | 'settled'>('open')
  const shown = [...trees]
    .filter((t) => (tab === 'open' ? !t.settled : t.settled))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  return (
    <aside className="clay-card panel">
      <button className="close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <h2>My arguments</h2>
      <div className="tabs">
        <button className={'tab' + (tab === 'open' ? ' on' : '')} onClick={() => setTab('open')}>
          Still going ({trees.filter((t) => !t.settled).length})
        </button>
        <button className={'tab' + (tab === 'settled' ? ' on' : '')} onClick={() => setTab('settled')}>
          Settled ({trees.filter((t) => t.settled).length})
        </button>
      </div>
      {shown.length === 0 && (
        <p className="hint">{tab === 'open' ? 'Nothing here yet. Press “I argued again” to start.' : 'Nothing settled yet.'}</p>
      )}
      {shown.map((t) => (
        <div key={t.id} className="tree-row">
          <div>
            <b>{t.title}</b>
            <small>
              {countFor(t.id)} points · {new Date(t.updated_at).toLocaleDateString()}
            </small>
            <span className="row">
              {peopleFor(t.id).map((p) => (
                <span key={p.id} className="dot" style={{ background: p.color }} title={p.name} />
              ))}
            </span>
          </div>
          <button className="clay-btn small" onClick={() => onOpenTree(t.id)}>
            Open
          </button>
        </div>
      ))}
    </aside>
  )
}
