import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CircleGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, Object3D } from 'three'
import { rng } from '../lib/random'
import { ISLAND_RADIUS } from './world'

const dummy = new Object3D()

function Ground() {
  const geometry = useMemo(() => {
    const g = new CircleGeometry(ISLAND_RADIUS + 4, 96, 0, Math.PI * 2)
    const r = rng(7)
    const colors: number[] = []
    const a = new Color('#7cc46b')
    const b = new Color('#5fae55')
    const c = new Color()
    for (let i = 0; i < g.attributes.position.count; i++) {
      c.copy(a).lerp(b, r())
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return g
  }, [])

  return (
    <>
      <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow name="ground">
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <ringGeometry args={[ISLAND_RADIUS + 3.5, ISLAND_RADIUS + 10, 96]} />
        <meshStandardMaterial color="#ead39c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
        <circleGeometry args={[600, 48]} />
        <meshStandardMaterial color="#4fb3d9" roughness={0.25} metalness={0.1} />
      </mesh>
      {/* a little path from the spawn point */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[3.2, 32]} />
        <meshStandardMaterial color="#d9b77c" roughness={1} />
      </mesh>
    </>
  )
}

function Instanced({ count, seed, make, children }: {
  count: number
  seed: number
  make: (r: () => number, i: number) => { x: number; y: number; z: number; s: number; ry: number; color?: string }
  children: React.ReactNode
}) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const r = rng(seed)
    const col = new Color()
    for (let i = 0; i < count; i++) {
      const p = make(r, i)
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(0, p.ry, 0)
      dummy.scale.setScalar(p.s)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
      if (p.color) m.setColorAt(i, col.set(p.color))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [count, seed, make])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      {children}
    </instancedMesh>
  )
}

function onIsland(r: () => number, min = 4, max = ISLAND_RADIUS - 2) {
  const a = r() * Math.PI * 2
  const d = Math.sqrt(min * min + r() * (max * max - min * min))
  return { x: Math.cos(a) * d, z: Math.sin(a) * d }
}

const GRASS = ['#4f9d45', '#6bbf59', '#86cf6b', '#3f8a3a']
const FLOWERS = ['#ffffff', '#ffd23f', '#ff7aa2', '#b388ff', '#ff9f43']

const grass = (r: () => number) => {
  const p = onIsland(r, 3.4)
  return { ...p, y: 0.12, s: 0.6 + r() * 0.8, ry: r() * 6, color: GRASS[Math.floor(r() * GRASS.length)] }
}
const flowers = (r: () => number) => {
  const p = onIsland(r, 3.4)
  return { ...p, y: 0.14, s: 0.7 + r() * 0.6, ry: 0, color: FLOWERS[Math.floor(r() * FLOWERS.length)] }
}
const rocks = (r: () => number) => {
  const p = onIsland(r, 6)
  return { ...p, y: 0.1, s: 0.3 + r() * 0.8, ry: r() * 6, color: r() > 0.5 ? '#9aa0a6' : '#b8b2a7' }
}
// A ring of pines marks the edge of the garden.
const pines = (r: () => number) => {
  const a = r() * Math.PI * 2
  const d = ISLAND_RADIUS - 6 + r() * 7
  const s = 1.4 + r() * 1.6
  return { x: Math.cos(a) * d, y: 1.8 * s, z: Math.sin(a) * d, s, ry: r() * 6, color: r() > 0.5 ? '#2f7d4f' : '#3c9160' }
}

function Clouds() {
  const group = useRef<Group>(null)
  const clouds = useMemo(() => {
    const r = rng(42)
    return Array.from({ length: 14 }, () => ({
      x: (r() - 0.5) * 220,
      y: 26 + r() * 14,
      z: (r() - 0.5) * 220,
      puffs: Array.from({ length: 4 + Math.floor(r() * 3) }, (_, i) => ({ x: i * 2.2 - 4, y: r() * 1.2, z: (r() - 0.5) * 2, s: 2 + r() * 1.6 })),
    }))
  }, [])
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.004
  })
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          {c.puffs.map((p, j) => (
            <mesh key={j} position={[p.x, p.y, p.z]}>
              <icosahedronGeometry args={[p.s, 1]} />
              <meshStandardMaterial color="#ffffff" flatShading roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function Signpost() {
  return (
    <group position={[-2.6, 0, -1.6]} rotation={[0, 0.5, 0]}>
      <mesh castShadow position={[0, 0.8, 0]}>
        <boxGeometry args={[0.14, 1.6, 0.14]} />
        <meshStandardMaterial color="#7a4a21" />
      </mesh>
      <mesh castShadow position={[0, 1.45, 0.05]}>
        <boxGeometry args={[1.5, 0.55, 0.08]} />
        <meshStandardMaterial color="#b97a3c" />
      </mesh>
    </group>
  )
}

export function Scenery() {
  return (
    <>
      <Ground />
      <Signpost />
      <Instanced count={2600} seed={1} make={grass}>
        <coneGeometry args={[0.07, 0.3, 3]} />
        <meshStandardMaterial roughness={1} />
      </Instanced>
      <Instanced count={420} seed={2} make={flowers}>
        <sphereGeometry args={[0.07, 6, 4]} />
        <meshStandardMaterial roughness={0.8} />
      </Instanced>
      <Instanced count={70} seed={3} make={rocks}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial roughness={1} flatShading />
      </Instanced>
      <Instanced count={160} seed={4} make={pines}>
        <coneGeometry args={[1.1, 3.6, 6]} />
        <meshStandardMaterial roughness={0.9} flatShading />
      </Instanced>
      <Clouds />
    </>
  )
}
