import { useEffect, useState } from 'react'
import { LIMITS, type Argument, type Match, type Person, type Point } from '../lib/supabase'
import { similarPoints } from '../lib/api'
import { nextColor } from '../lib/random'
import { PersonEditor } from './PersonEditor'

type Props = {
  argument: Argument
  people: Person[]
  allPeople: Person[]
  points: Point[]
  titleOf: (argumentId: string) => string
  personOf: (personId: string) => Person | undefined
  embedVersion: number
  onClose: () => void
  onLog: (personId: string, text: string) => Promise<void>
  onEditPoint: (id: string, text: string) => Promise<void>
  onDeletePoint: (id: string) => Promise<void>
  onRename: (title: string) => Promise<void>
  onSettled: (settled: boolean) => Promise<void>
  onDelete: () => Promise<void>
  onSavePerson: (id: string | null, name: string, color: string) => Promise<Person>
  onAddPeople: (ids: string[]) => Promise<void>
  onOpenTree: (argumentId: string) => void
}

const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function ArgumentPanel(props: Props) {
  const { argument, people, points } = props
  const [who, setWho] = useState(people[0]?.id ?? '')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [title, setTitle] = useState(argument.title)
  const [editingPoint, setEditingPoint] = useState<string | null>(null)
  const [pointText, setPointText] = useState('')
  const [editingPerson, setEditingPerson] = useState<Person | 'new' | null>(null)
  const [similar, setSimilar] = useState<Match[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setTitle(argument.title)
    setRenaming(false)
    setConfirmDelete(false)
  }, [argument.id, argument.title])

  useEffect(() => {
    if (!people.some((p) => p.id === who)) setWho(people[0]?.id ?? '')
  }, [people, who])

  // "This has come up before": points from other trees that mean something similar.
  useEffect(() => {
    let alive = true
    similarPoints(argument.id)
      .then((m) => alive && setSimilar(m.filter((x) => x.similarity >= 0.8)))
      .catch(() => alive && setSimilar([]))
    return () => {
      alive = false
    }
  }, [argument.id, props.embedVersion])

  if (editingPerson) {
    const p = editingPerson === 'new' ? null : editingPerson
    return (
      <aside className="clay-card panel">
        <PersonEditor
          title={p ? (p.is_me ? 'Your colour' : `Edit ${p.name}`) : 'Add someone to this argument'}
          initialName={p ? p.name : ''}
          initialColor={p ? p.color : nextColor(props.allPeople.map((x) => x.color))}
          nameLocked={p?.is_me}
          saveLabel={p ? 'Save' : 'Add'}
          onCancel={() => setEditingPerson(null)}
          onSave={async (name, color) => {
            const saved = await props.onSavePerson(p?.id ?? null, name, color)
            if (!p) await props.onAddPeople([saved.id])
            setEditingPerson(null)
          }}
        />
      </aside>
    )
  }

  const others = props.allPeople.filter((p) => !people.some((x) => x.id === p.id))
  const canAddMore = people.length < LIMITS.people

  return (
    <aside className="clay-card panel">
      <button className="close" onClick={props.onClose} aria-label="Close">
        ✕
      </button>

      {renaming ? (
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!title.trim()) return
            await props.onRename(title.trim())
            setRenaming(false)
          }}
        >
          <input className="clay-input" value={title} maxLength={LIMITS.title} autoFocus onChange={(e) => setTitle(e.target.value)} />
          <button className="clay-btn green small">Save</button>
        </form>
      ) : (
        <h2 className="panel-title">
          {argument.title}
          <button className="pencil" onClick={() => setRenaming(true)} aria-label="Rename">
            ✎
          </button>
        </h2>
      )}
      <p className="meta">
        Started {when(argument.created_at)} · {points.length} {points.length === 1 ? 'point' : 'points'}
        {argument.settled && <span className="badge">Settled</span>}
      </p>

      <div className="chips">
        {people.map((p) => (
          <button
            key={p.id}
            className="chip on"
            style={{ ['--c' as string]: p.color }}
            onClick={() => setEditingPerson(p)}
            title="Change name or colour"
          >
            <span className="dot" style={{ background: p.color }} />
            {p.name}
          </button>
        ))}
        {canAddMore &&
          others.map((p) => (
            <button key={p.id} className="chip faded" onClick={() => props.onAddPeople([p.id])} title={`Add ${p.name}`}>
              + {p.name}
            </button>
          ))}
        {canAddMore && (
          <button className="chip add" onClick={() => setEditingPerson('new')}>
            + Someone new
          </button>
        )}
      </div>

      <form
        className="log-box"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!who || !text.trim()) return
          setBusy(true)
          try {
            await props.onLog(who, text.trim())
            setText('')
          } finally {
            setBusy(false)
          }
        }}
      >
        <span className="label">Who said it?</span>
        <div className="chips">
          {people.map((p) => (
            <button
              type="button"
              key={p.id}
              className={'chip' + (who === p.id ? ' on' : '')}
              style={{ ['--c' as string]: p.color }}
              onClick={() => setWho(p.id)}
            >
              <span className="dot" style={{ background: p.color }} />
              {p.name}
            </button>
          ))}
        </div>
        <textarea
          className="clay-input"
          rows={3}
          maxLength={LIMITS.point}
          placeholder="What did they say? Write it however it comes out."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit()
          }}
        />
        <div className="row end">
          <small className="count">
            {text.length}/{LIMITS.point}
          </small>
          <button className="clay-btn green" disabled={busy || !text.trim() || !who}>
            {busy ? 'Logging…' : 'Log it'}
          </button>
        </div>
      </form>

      <div className="points">
        {points.length === 0 && <p className="hint">No points yet. Log what each person said and watch the tree grow.</p>}
        {[...points].reverse().map((pt) => {
          const p = props.personOf(pt.person_id)
          const mine = editingPoint === pt.id
          return (
            <div key={pt.id} className="point" style={{ ['--c' as string]: p?.color ?? '#999' }}>
              <div className="point-head">
                <span className="dot" style={{ background: p?.color }} />
                <b>{p?.name ?? 'Someone'}</b>
                <small>{when(pt.created_at)}</small>
                {!mine && (
                  <span className="point-actions">
                    <button
                      onClick={() => {
                        setEditingPoint(pt.id)
                        setPointText(pt.text)
                      }}
                    >
                      Edit
                    </button>
                    <button onClick={() => props.onDeletePoint(pt.id)}>Remove</button>
                  </span>
                )}
              </div>
              {mine ? (
                <div>
                  <textarea className="clay-input" rows={3} maxLength={LIMITS.point} value={pointText} onChange={(e) => setPointText(e.target.value)} />
                  <div className="row end">
                    <button className="clay-btn ghost small" onClick={() => setEditingPoint(null)}>
                      Cancel
                    </button>
                    <button
                      className="clay-btn green small"
                      disabled={!pointText.trim()}
                      onClick={async () => {
                        await props.onEditPoint(pt.id, pointText.trim())
                        setEditingPoint(null)
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p>{pt.text}</p>
              )}
            </div>
          )
        })}
      </div>

      {similar.length > 0 && (
        <div className="similar">
          <h3>This has come up before</h3>
          {similar.map((m) => {
            const p = props.personOf(m.person_id)
            return (
              <div key={m.id} className="similar-item">
                <span className="dot" style={{ background: p?.color }} />
                <div>
                  <p>“{m.text.length > 140 ? m.text.slice(0, 137) + '…' : m.text}”</p>
                  <small>
                    {p?.name} · in “{props.titleOf(m.argument_id)}”
                  </small>
                </div>
                <button className="clay-btn small" onClick={() => props.onOpenTree(m.argument_id)}>
                  Open
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="row spread footer">
        <button className="clay-btn yellow" onClick={() => props.onSettled(!argument.settled)}>
          {argument.settled ? 'Reopen' : 'Mark as settled'}
        </button>
        {confirmDelete ? (
          <span className="row">
            <small>Delete this tree for good?</small>
            <button className="clay-btn ghost small" onClick={() => setConfirmDelete(false)}>
              No
            </button>
            <button className="clay-btn red small" onClick={props.onDelete}>
              Yes, delete
            </button>
          </span>
        ) : (
          <button className="clay-btn ghost" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
      </div>
    </aside>
  )
}
