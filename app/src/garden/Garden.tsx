import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { DirectionalLight, Mesh, MeshBasicMaterial } from 'three'
import type { Argument, Person, Point } from '../lib/supabase'
import { Player } from './Player'
import { Scenery } from './Scenery'
import { Tree } from './Tree'
import { walkTo, world } from './world'

type Props = {
  trees: Argument[]
  peopleFor: (argumentId: string) => Person[]
  pointsFor: (argumentId: string) => Point[]
  selectedId: string | null
  glowing: Set<string>
  onOpen: (id: string) => void
  onNear: (id: string | null) => void
}

function Sun() {
  const light = useRef<DirectionalLight>(null)
  useFrame(() => {
    const l = light.current
    if (!l) return
    const p = world.player
    l.position.set(p.x + 18, 30, p.z + 12)
    l.target.position.set(p.x, 0, p.z)
    l.target.updateMatrixWorld()
  })
  return (
    <directionalLight
      ref={light}
      intensity={2.2}
      color="#fff4d6"
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-30}
      shadow-camera-right={30}
      shadow-camera-top={30}
      shadow-camera-bottom={-30}
      shadow-camera-near={1}
      shadow-camera-far={80}
      shadow-bias={-0.0005}
    />
  )
}

function ClickMarker() {
  const ring = useRef<Mesh>(null)
  useFrame((state) => {
    const m = ring.current
    if (!m) return
    const t = world.target
    m.visible = !!t
    if (t) {
      m.position.set(t.x, 0.04, t.z)
      const s = 1 + Math.sin(state.clock.elapsedTime * 6) * 0.12
      m.scale.set(s, s, s)
      ;(m.material as MeshBasicMaterial).opacity = 0.8
    }
  })
  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.35, 0.5, 24]} />
      <meshBasicMaterial color="#fff6a8" transparent />
    </mesh>
  )
}

export function Garden({ trees, peopleFor, pointsFor, selectedId, glowing, onOpen, onNear }: Props) {
  useEffect(() => {
    world.trees = trees.map((t) => ({ id: t.id, x: t.x, z: t.z }))
  }, [trees])

  const onGround = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return
    walkTo(e.point.x, e.point.z)
  }

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 50, near: 0.1, far: 900, position: [6, 9, 14] }}
      gl={{ antialias: true }}
      onCreated={({ scene }) => {
        scene.background = null
      }}
    >
      <fog attach="fog" args={['#cfe9ff', 60, 220]} />
      <Sky sunPosition={[80, 40, 50]} turbidity={4} rayleigh={0.6} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <hemisphereLight args={['#dff3ff', '#6a8f4e', 1.1]} />
      <Sun />
      <Suspense fallback={null}>
        <group onClick={onGround}>
          <Scenery />
        </group>
        {trees.map((t) => (
          <Tree
            key={t.id}
            argument={t}
            people={peopleFor(t.id)}
            points={pointsFor(t.id)}
            selected={t.id === selectedId}
            glowing={glowing.has(t.id)}
            onOpen={onOpen}
          />
        ))}
        <Player onNear={onNear} />
        <ClickMarker />
      </Suspense>
    </Canvas>
  )
}
