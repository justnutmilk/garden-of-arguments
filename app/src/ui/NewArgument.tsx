import { useState } from 'react'
import { LIMITS, type Person } from '../lib/supabase'
import { nextColor } from '../lib/random'
import { PersonEditor } from './PersonEditor'

type Props = {
  people: Person[]
  onAddPerson: (name: string, color: string) => Promise<Person>
  onSave: (title: string, personIds: string[]) => Promise<void>
  onClose: () => void
}

export function NewArgument({ people, onAddPerson, onSave, onClose }: Props) {
  const me = people.find((p) => p.is_me)
  const [title, setTitle] = useState('')
  const [chosen, setChosen] = useState<string[]>(me ? [me.id] : [])
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)

  const toggle = (id: string) =>
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= LIMITS.people ? c : [...c, id]))

  const ready = title.trim().length > 0 && chosen.length >= 2 && chosen.length <= LIMITS.people

  if (adding) {
    return (
      <div className="clay-card modal">
        <PersonEditor
          title="Add someone"
          initialName=""
          initialColor={nextColor(people.map((p) => p.color))}
          saveLabel="Add"
          onCancel={() => setAdding(false)}
          onSave={async (name, color) => {
            const p = await onAddPerson(name, color)
            setChosen((c) => (c.length < LIMITS.people ? [...c, p.id] : c))
            setAdding(false)
          }}
        />
      </div>
    )
  }

  return (
    <div className="clay-card modal">
      <button className="close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <h2>I argued again</h2>
      <label className="field">
        <span>What was it about?</span>
        <input
          className="clay-input"
          placeholder="e.g. Who does the dishes"
          value={title}
          maxLength={LIMITS.title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <div className="field">
        <span>
          Who was there? <small>(2 to 6 people)</small>
        </span>
        <div className="chips">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              className={'chip' + (chosen.includes(p.id) ? ' on' : '')}
              style={{ ['--c' as string]: p.color }}
              onClick={() => toggle(p.id)}
            >
              <span className="dot" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
          <button type="button" className="chip add" onClick={() => setAdding(true)} disabled={chosen.length >= LIMITS.people}>
            + Add someone
          </button>
        </div>
      </div>

      <div className="row end">
        <button className="clay-btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="clay-btn green big"
          disabled={!ready || busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave(title.trim(), chosen)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      {chosen.length < 2 && <p className="hint">Pick at least two people.</p>}
    </div>
  )
}
