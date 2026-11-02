import { useState } from 'react'
import { LIMITS } from '../lib/supabase'
import { ColorPicker } from './ColorPicker'

type Props = {
  title: string
  initialName: string
  initialColor: string
  nameLocked?: boolean
  saveLabel?: string
  onSave: (name: string, color: string) => Promise<void> | void
  onCancel: () => void
}

export function PersonEditor({ title, initialName, initialColor, nameLocked, saveLabel = 'Save', onSave, onCancel }: Props) {
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState(initialColor)
  const [busy, setBusy] = useState(false)
  const ok = name.trim().length > 0

  return (
    <div className="person-editor">
      <h3>{title}</h3>
      <div className="person-preview">
        <span className="dot big" style={{ background: color }} />
        <input
          className="clay-input"
          placeholder="Their name"
          value={name}
          maxLength={LIMITS.name}
          disabled={nameLocked}
          autoFocus={!nameLocked}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <ColorPicker value={color} onChange={setColor} />
      <div className="row end">
        <button type="button" className="clay-btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="clay-btn green"
          disabled={!ok || busy}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave(name.trim(), color)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  )
}
