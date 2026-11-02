import { useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Color, Group, Quaternion, Vector3 } from 'three'
import type { Argument, Person, Point } from '../lib/supabase'
import { hash, rng } from '../lib/random'

type Props = {
  argument: Argument
  people: Person[]
  points: Point[]
  selected: boolean
  glowing: boolean
  onOpen: (id: string) => void
}

type Branch = {
  key: string
  text: string
  person: string
  color: string
  mid: Vector3
  quat: Quaternion
  length: number
  radius: number
  tip: Vector3
  leaves: { pos: Vector3; r: number; color: string }[]
}

const UP = new Vector3(0, 1, 0)
const BARK = '#7a4a21'

function shade(hex: string, amount: number) {
  const c = new Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.min(0.85, Math.max(0.12, hsl.l + amount)))
  return '#' + c.getHexString()
}

// One argument grows one tree. Each point is a branch ending in a clump of
// leaves in the colour of whoever made it. Each person grows on their own side.
function grow(argument: Argument, people: Person[], points: Point[]) {
  const r = rng(hash(argument.id))
  const n = Math.max(points.length, 0)
  const height = 1.7 + Math.min(n, 18) * 0.24
  const trunkR = 0.16 + Math.min(n, 18) * 0.018
  const spin = r() * Math.PI * 2
  const sides = Math.max(people.length, 1)

  const branches: Branch[] = points.map((p, i) => {
    const who = Math.max(0, people.findIndex((x) => x.id === p.person_id))
    const person = people[who]
    const color = person?.color ?? '#3fa34d'
    const spread = sides <= 2 ? 1.1 : (Math.PI * 2) / sides * 0.7
    const angle = spin + (who * Math.PI * 2) / sides + (r() - 0.5) * spread
    const h = height * (0.38 + 0.55 * ((i + 0.5) / n)) + (r() - 0.5) * 0.15
    const length = (0.75 + 1.25 * Math.min(p.text.length, 280) / 280) * (0.9 + r() * 0.25)
    const lift = 0.45 + r() * 0.45
    const dir = new Vector3(Math.cos(angle) * Math.cos(lift), Math.sin(lift), Math.sin(angle) * Math.cos(lift))
    const start = new Vector3(0, h, 0).addScaledVector(dir, trunkR * 0.6)
    const tip = start.clone().addScaledVector(dir, length)
    const mid = start.clone().lerp(tip, 0.5)
    const quat = new Quaternion().setFromUnitVectors(UP, dir)
    const leafR = 0.34 + length * 0.17
    const leaves = [0, 1, 2].map((k) => ({
      pos: tip.clone().add(new Vector3((r() - 0.5) * leafR, (r() - 0.2) * leafR * 0.8, (r() - 0.5) * leafR)),
      r: leafR * (k === 0 ? 1 : 0.62 + r() * 0.2),
      color: k === 0 ? color : shade(color, (r() - 0.5) * 0.18),
    }))
    return {
      key: p.id,
      text: p.text,
      person: person?.name ?? '',
      color,
      mid,
      quat,
      length,
      radius: 0.035 + Math.min(p.text.length, 400) / 400 * 0.05,
      tip,
      leaves,
    }
  })

  const flowers = argument.settled
    ? Array.from({ length: 9 }, () => {
        const a = r() * Math.PI * 2
        const d = 0.7 + r() * 0.9
        return { pos: new Vector3(Math.cos(a) * d, 0.12, Math.sin(a) * d), color: r() > 0.5 ? '#ffd6e8' : '#fff3b0' }
      })
    : []

  return { height, trunkR, branches, flowers }
}

export function Tree({ argument, people, points, selected, glowing, onOpen }: Props) {
  const group = useRef<Group>(null)
  const label = useRef<HTMLDivElement>(null)
  const grown = useRef(0)
  const [hovered, setHovered] = useState<Branch | null>(null)
  const shape = useMemo(() => grow(argument, people, points), [argument, people, points])

  useFrame((state, dt) => {
    const g = group.current
    if (!g) return
    // Grow in on first appearance, and glide when the tree is replanted near similar ones.
    grown.current = Math.min(1, grown.current + dt * 1.4)
    const s = 1 - Math.pow(1 - grown.current, 3)
    const pulse = glowing ? 1 + Math.sin(state.clock.elapsedTime * 5) * 0.04 : 1
    g.scale.setScalar(Math.max(0.001, s * pulse))
    g.position.x += (argument.x - g.position.x) * Math.min(1, dt * 2)
    g.position.z += (argument.z - g.position.z) * Math.min(1, dt * 2)
    if (label.current) {
      const far = state.camera.position.distanceTo(g.position) > 30
      label.current.style.opacity = far && !selected ? '0' : '1'
    }
  })

  const top = shape.height + 0.8

  return (
    <group
      ref={group}
      position={[argument.x, 0, argument.z]}
      onClick={(e) => {
        if (e.delta > 6) return
        e.stopPropagation()
        onOpen(argument.id)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
        setHovered(null)
      }}
    >
      {/* roots + trunk */}
      <mesh castShadow receiveShadow position={[0, 0.12, 0]}>
        <coneGeometry args={[shape.trunkR * 2.6, 0.35, 7]} />
        <meshStandardMaterial color={BARK} roughness={0.9} flatShading />
      </mesh>
      <mesh castShadow position={[0, shape.height / 2, 0]}>
        <cylinderGeometry args={[shape.trunkR * 0.55, shape.trunkR, shape.height, 7]} />
        <meshStandardMaterial color={BARK} roughness={0.9} flatShading />
      </mesh>

      {shape.branches.length === 0 && (
        <>
          <mesh castShadow position={[0.22, shape.height * 0.85, 0]} rotation={[0, 0, -0.6]}>
            <sphereGeometry args={[0.22, 6, 4]} />
            <meshStandardMaterial color="#7cc46b" flatShading />
          </mesh>
          <mesh castShadow position={[-0.2, shape.height * 0.95, 0.05]}>
            <sphereGeometry args={[0.18, 6, 4]} />
            <meshStandardMaterial color="#8fd47b" flatShading />
          </mesh>
        </>
      )}

      {shape.branches.map((b) => (
        <group key={b.key}>
          <mesh castShadow position={b.mid} quaternion={b.quat}>
            <cylinderGeometry args={[b.radius * 0.6, b.radius, b.length, 5]} />
            <meshStandardMaterial color={BARK} roughness={0.9} flatShading />
          </mesh>
          {b.leaves.map((l, i) => (
            <mesh
              key={i}
              castShadow
              position={l.pos}
              onPointerOver={(e) => {
                e.stopPropagation()
                document.body.style.cursor = 'pointer'
                setHovered(b)
              }}
            >
              <icosahedronGeometry args={[l.r, 0]} />
              <meshStandardMaterial
                color={l.color}
                roughness={0.75}
                flatShading
                emissive={hovered === b || glowing ? l.color : '#000000'}
                emissiveIntensity={hovered === b ? 0.35 : glowing ? 0.2 : 0}
              />
            </mesh>
          ))}
        </group>
      ))}

      {shape.flowers.map((f, i) => (
        <mesh key={i} position={f.pos}>
          <sphereGeometry args={[0.09, 6, 4]} />
          <meshStandardMaterial color={f.color} emissive={f.color} emissiveIntensity={0.25} />
        </mesh>
      ))}

      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[1.5, 1.75, 40]} />
          <meshBasicMaterial color="#fff6a8" transparent opacity={0.85} />
        </mesh>
      )}

      <Html position={[0, top, 0]} center distanceFactor={12} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={label} className={'tree-sign' + (argument.settled ? ' settled' : '')}>
          {argument.title}
        </div>
      </Html>

      {hovered && (
        <Html position={hovered.tip} center distanceFactor={10} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div className="leaf-tip" style={{ borderColor: hovered.color }}>
            <b style={{ color: hovered.color }}>{hovered.person}</b>
            <span>{hovered.text.length > 160 ? hovered.text.slice(0, 157) + '…' : hovered.text}</span>
          </div>
        </Html>
      )}
    </group>
  )
}
