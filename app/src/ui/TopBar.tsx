import { useEffect, useState } from 'react'

type Props = {
  name: string
  saved: boolean
  onRename: (name: string) => Promise<void>
  onAccount: () => void
}

export function TopBar({ name, saved, onRename, onAccount }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)

  useEffect(() => setValue(name), [name])

  const finish = async () => {
    const v = value.trim()
    setEditing(false)
    if (v && v !== name) await onRename(v)
    else setValue(name)
  }

  return (
    <header className="topbar wood">
      <h1 className="game-title">
        <span className="leaf">🌳</span> Garden of Arguments
      </h1>
      <div className="topbar-right">
        <div className="name-tag">
          {editing ? (
            <input
              className="name-input"
              value={value}
              maxLength={40}
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              onBlur={finish}
              onKeyDown={(e) => {
                if (e.key === 'Enter') finish()
                if (e.key === 'Escape') {
                  setValue(name)
                  setEditing(false)
                }
              }}
            />
          ) : (
            <>
              <span>{name || '…'}</span>
              <button className="pencil" onClick={() => setEditing(true)} aria-label="Change your name">
                ✎
              </button>
            </>
          )}
        </div>
        <button className="clay-btn small" onClick={onAccount}>
          {saved ? 'Account' : 'Save my garden'}
        </button>
      </div>
    </header>
  )
}
