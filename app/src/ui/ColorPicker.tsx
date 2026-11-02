import { useEffect, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import { PALETTE } from '../lib/random'

type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }

const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb: number[]) =>
  '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v || 0))).toString(16).padStart(2, '0')).join('')
const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v)

// Wheel, swatches, hex code, RGB numbers and (where the browser supports it) an eyedropper.
export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hexText, setHexText] = useState(value)
  const dropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper

  useEffect(() => setHexText(value), [value])

  const rgb = toRgb(value)

  return (
    <div className="color-picker">
      <HexColorPicker color={value} onChange={(c) => onChange(c.toLowerCase())} />
      <div className="swatches">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            className={'swatch' + (c === value.toLowerCase() ? ' on' : '')}
            style={{ background: c }}
            aria-label={'Use colour ' + c}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
      <div className="color-fields">
        <label>
          Hex
          <input
            value={hexText}
            maxLength={7}
            onChange={(e) => {
              let v = e.target.value.trim()
              if (!v.startsWith('#')) v = '#' + v
              setHexText(v)
              if (isHex(v)) onChange(v.toLowerCase())
            }}
          />
        </label>
        {['R', 'G', 'B'].map((ch, i) => (
          <label key={ch}>
            {ch}
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[i]}
              onChange={(e) => {
                const next = [...rgb]
                next[i] = Number(e.target.value)
                onChange(toHex(next))
              }}
            />
          </label>
        ))}
        {dropper && (
          <button
            type="button"
            className="clay-btn small"
            title="Pick a colour from your screen"
            onClick={async () => {
              try {
                const res = await new dropper().open()
                onChange(res.sRGBHex.toLowerCase())
              } catch {
                /* closed without picking */
              }
            }}
          >
            💧 Pick
          </button>
        )}
      </div>
    </div>
  )
}
