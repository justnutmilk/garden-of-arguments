import { useCallback, useEffect, useMemo, useState } from 'react'
import * as api from './lib/api'
import { useUser } from './lib/auth'
import type { Argument, ArgumentPerson, Person, Point } from './lib/supabase'
import { Garden } from './garden/Garden'
import { walkTo } from './garden/world'
import { TopBar } from './ui/TopBar'
import { NewArgument } from './ui/NewArgument'
import { ArgumentPanel } from './ui/ArgumentPanel'
import { SearchPanel } from './ui/SearchPanel'
import { ListPanel } from './ui/ListPanel'
import { AccountModal } from './ui/AccountModal'

type View = { kind: 'none' } | { kind: 'tree'; id: string } | { kind: 'search' } | { kind: 'list' }
type Modal = null | 'new' | 'account'

const NO_PEOPLE: Person[] = []
const NO_POINTS: Point[] = []

export default function App() {
  const { user, error: authError } = useUser()
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [trees, setTrees] = useState<Argument[]>([])
  const [links, setLinks] = useState<ArgumentPerson[]>([])
  const [points, setPoints] = useState<Point[]>([])
  const [view, setView] = useState<View>({ kind: 'none' })
  const [modal, setModal] = useState<Modal>(null)
  const [near, setNear] = useState<string | null>(null)
  const [glowing, setGlowing] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<string | null>(null)
  const [embedVersion, setEmbedVersion] = useState(0)

  const say = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 3200)
  }, [])

  const fail = useCallback((e: unknown) => {
    console.error(e)
    say(e instanceof Error ? e.message : 'Something went wrong. Try again.')
  }, [say])

  // Load (or reload, after signing in) this user's garden.
  useEffect(() => {
    if (!user) return
    let alive = true
    setLoaded(false)
    setView({ kind: 'none' })
    api
      .loadGarden(user.id)
      .then((g) => {
        if (!alive) return
        setName(g.name)
        setPeople(g.people)
        setTrees(g.arguments)
        setLinks(g.links)
        setPoints(g.points)
        setLoaded(true)
      })
      .catch((e) => {
        fail(e)
        setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [user?.id, fail])

  // Stable per-tree lists so trees only regrow when their own data changes.
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const peopleByTree = useMemo(() => {
    const m = new Map<string, Person[]>()
    for (const l of links) {
      const p = personById.get(l.person_id)
      if (!p) continue
      if (!m.has(l.argument_id)) m.set(l.argument_id, [])
      m.get(l.argument_id)!.push(p)
    }
    for (const list of m.values()) list.sort((a, b) => Number(b.is_me) - Number(a.is_me) || a.created_at.localeCompare(b.created_at))
    return m
  }, [links, personById])
  const pointsByTree = useMemo(() => {
    const m = new Map<string, Point[]>()
    for (const p of points) {
      if (!m.has(p.argument_id)) m.set(p.argument_id, [])
      m.get(p.argument_id)!.push(p)
    }
    return m
  }, [points])

  const peopleFor = useCallback((id: string) => peopleByTree.get(id) ?? NO_PEOPLE, [peopleByTree])
  const pointsFor = useCallback((id: string) => pointsByTree.get(id) ?? NO_POINTS, [pointsByTree])
  const personOf = useCallback((id: string) => personById.get(id), [personById])
  const titleOf = useCallback((id: string) => trees.find((t) => t.id === id)?.title ?? 'an old argument', [trees])

  const openTree = useCallback(
    (id: string, walk = true) => {
      const t = trees.find((x) => x.id === id)
      if (!t) return
      if (walk) walkTo(t.x, t.z, 2.4)
      setView({ kind: 'tree', id })
    },
    [trees],
  )

  // E opens the tree you are standing next to.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.key.toLowerCase() === 'e' && near) openTree(near, false)
      if (e.key === 'Escape') {
        setModal(null)
        setView({ kind: 'none' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [near, openTree])

  const replaceTree = (t: Partial<Argument> & { id: string }) =>
    setTrees((all) => all.map((x) => (x.id === t.id ? { ...x, ...t } : x)))

  // Embed in the background; the tree may glide to sit next to similar ones.
  const embed = (pointId: string) =>
    api
      .embedPoint(pointId)
      .then((tree) => {
        if (tree) replaceTree(tree)
        setEmbedVersion((v) => v + 1)
      })
      .catch((e) => console.warn('embedding failed', e))

  if (authError) {
    return (
      <div className="loading">
        <h1 className="game-title">Garden of Arguments</h1>
        <p>Couldn't open your garden: {authError}</p>
      </div>
    )
  }

  if (!user || !loaded) {
    return (
      <div className="loading">
        <h1 className="game-title">Garden of Arguments</h1>
        <div className="sprout">🌱</div>
        <p>Getting your garden ready…</p>
      </div>
    )
  }

  const current = view.kind === 'tree' ? trees.find((t) => t.id === view.id) : undefined
  const nearTree = near ? trees.find((t) => t.id === near) : undefined
  const panelOpen = view.kind !== 'none'

  return (
    <div className="app">
      <div className="canvas-wrap">
        <Garden
          trees={trees}
          peopleFor={peopleFor}
          pointsFor={pointsFor}
          selectedId={current?.id ?? null}
          glowing={glowing}
          onOpen={(id) => openTree(id)}
          onNear={setNear}
        />
      </div>

      <TopBar
        name={name}
        saved={!user.is_anonymous}
        onAccount={() => setModal('account')}
        onRename={async (n) => {
          const old = name
          setName(n)
          try {
            await api.saveName(user.id, n)
            say('Name saved')
          } catch (e) {
            setName(old)
            fail(e)
          }
        }}
      />

      {toast && <div className="toast">{toast}</div>}

      {trees.length === 0 && view.kind === 'none' && !modal && (
        <div className="near-prompt" style={{ bottom: 100 }}>
          Your garden is empty. Press “I argued again” to grow your first tree.
        </div>
      )}

      {nearTree && !panelOpen && !modal && (
        <button className="near-prompt" onClick={() => openTree(nearTree.id, false)}>
          <kbd>E</kbd> Open “{nearTree.title}”
        </button>
      )}

      <div className="help">WASD / arrows to walk · click the ground to go there · drag to look · scroll to zoom</div>

      <nav className={'dock' + (modal ? ' hidden' : '')}>
        <button className="clay-btn green big" onClick={() => setModal('new')}>
          🌱 I argued again
        </button>
        <button className="clay-btn" onClick={() => setView(view.kind === 'search' ? { kind: 'none' } : { kind: 'search' })}>
          🔍 Search
        </button>
        <button className="clay-btn" onClick={() => setView(view.kind === 'list' ? { kind: 'none' } : { kind: 'list' })}>
          📜 My arguments
        </button>
      </nav>

      {current && (
        <ArgumentPanel
          key={current.id}
          argument={current}
          people={peopleFor(current.id)}
          allPeople={people}
          points={pointsFor(current.id)}
          titleOf={titleOf}
          personOf={personOf}
          embedVersion={embedVersion}
          onClose={() => setView({ kind: 'none' })}
          onOpenTree={(id) => openTree(id)}
          onLog={async (personId, text) => {
            try {
              const p = await api.addPoint(current.id, personId, text)
              setPoints((all) => [...all, p])
              replaceTree({ id: current.id, updated_at: new Date().toISOString() })
              embed(p.id)
            } catch (e) {
              fail(e)
            }
          }}
          onEditPoint={async (id, text) => {
            try {
              const p = await api.updatePoint(id, text)
              setPoints((all) => all.map((x) => (x.id === id ? p : x)))
              embed(p.id)
            } catch (e) {
              fail(e)
            }
          }}
          onDeletePoint={async (id) => {
            try {
              await api.deletePoint(id)
              setPoints((all) => all.filter((x) => x.id !== id))
              setEmbedVersion((v) => v + 1)
            } catch (e) {
              fail(e)
            }
          }}
          onRename={async (title) => {
            try {
              replaceTree(await api.updateArgument(current.id, { title }))
            } catch (e) {
              fail(e)
            }
          }}
          onSettled={async (settled) => {
            try {
              replaceTree(await api.updateArgument(current.id, { settled }))
              say(settled ? 'Marked as settled 🌸' : 'Reopened')
            } catch (e) {
              fail(e)
            }
          }}
          onDelete={async () => {
            try {
              await api.deleteArgument(current.id)
              setTrees((all) => all.filter((t) => t.id !== current.id))
              setLinks((all) => all.filter((l) => l.argument_id !== current.id))
              setPoints((all) => all.filter((p) => p.argument_id !== current.id))
              setView({ kind: 'none' })
              say('Tree deleted')
            } catch (e) {
              fail(e)
            }
          }}
          onSavePerson={async (id, personName, color) => {
            const p = id ? await api.updatePerson(id, personName, color) : await api.addPerson(personName, color)
            setPeople((all) => (id ? all.map((x) => (x.id === id ? p : x)) : [...all, p]))
            return p
          }}
          onAddPeople={async (ids) => {
            try {
              const added = await api.addPeopleToArgument(current.id, ids)
              setLinks((all) => [...all, ...added])
            } catch (e) {
              fail(e)
            }
          }}
        />
      )}

      {view.kind === 'search' && (
        <SearchPanel
          personOf={personOf}
          titleOf={titleOf}
          onResults={(ids) => {
            setGlowing(new Set(ids))
            window.setTimeout(() => setGlowing(new Set()), 8000)
          }}
          onOpenTree={(id) => openTree(id)}
          onClose={() => {
            setGlowing(new Set())
            setView({ kind: 'none' })
          }}
        />
      )}

      {view.kind === 'list' && (
        <ListPanel
          trees={trees}
          peopleFor={peopleFor}
          countFor={(id) => pointsFor(id).length}
          onOpenTree={(id) => openTree(id)}
          onClose={() => setView({ kind: 'none' })}
        />
      )}

      {modal && (
        <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && setModal(null)}>
          {modal === 'new' && (
            <NewArgument
              people={people}
              onClose={() => setModal(null)}
              onAddPerson={async (n, c) => {
                try {
                  const p = await api.addPerson(n, c)
                  setPeople((all) => [...all, p])
                  return p
                } catch (e) {
                  fail(e)
                  throw e
                }
              }}
              onSave={async (title, ids) => {
                try {
                  const { argument, links: added } = await api.addArgument(title, ids)
                  setTrees((all) => [...all, argument])
                  setLinks((all) => [...all, ...added])
                  setModal(null)
                  walkTo(argument.x, argument.z, 2.4)
                  setView({ kind: 'tree', id: argument.id })
                  say('New tree planted. Log what everyone said!')
                } catch (e) {
                  fail(e)
                }
              }}
            />
          )}
          {modal === 'account' && (
            <AccountModal
              user={user}
              treeCount={trees.length}
              onClose={() => setModal(null)}
              onDone={(msg) => {
                setModal(null)
                say(msg)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

