import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Group, Mesh, Vector3 } from 'three'
import { ISLAND_RADIUS, world } from './world'

const MOVE_KEYS: Record<string, [number, number]> = {
  w: [0, 1], arrowup: [0, 1],
  s: [0, -1], arrowdown: [0, -1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0], arrowright: [1, 0],
}

function typing() {
  const el = document.activeElement as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}

const tmp = new Vector3()
const fwd = new Vector3()
const right = new Vector3()
const want = new Vector3()

// A little gardener you steer with WASD / arrow keys, or by clicking/tapping the ground.
// Drag to turn the camera, scroll to zoom.
export function Player({ onNear }: { onNear: (id: string | null) => void }) {
  const body = useRef<Group>(null)
  const footL = useRef<Mesh>(null)
  const footR = useRef<Mesh>(null)
  const near = useRef<string | null>(null)
  const { camera, gl } = useThree()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing()) return
      const k = e.key.toLowerCase()
      if (k in MOVE_KEYS || k === 'shift') {
        world.keys.add(k)
        world.target = null
        if (k.startsWith('arrow')) e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => world.keys.delete(e.key.toLowerCase())
    const blur = () => world.keys.clear()

    const el = gl.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0
    const pDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
    }
    const pMove = (e: PointerEvent) => {
      if (!dragging || e.buttons === 0) return
      world.yaw -= (e.clientX - lastX) * 0.006
      world.distance = Math.min(24, Math.max(5, world.distance + (e.clientY - lastY) * 0.02))
      lastX = e.clientX
      lastY = e.clientY
    }
    const pUp = () => (dragging = false)
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      world.distance = Math.min(24, Math.max(5, world.distance + e.deltaY * 0.01))
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    el.addEventListener('pointerdown', pDown)
    window.addEventListener('pointermove', pMove)
    window.addEventListener('pointerup', pUp)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      el.removeEventListener('pointerdown', pDown)
      window.removeEventListener('pointermove', pMove)
      window.removeEventListener('pointerup', pUp)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const p = world.player

    fwd.set(-Math.sin(world.yaw), 0, -Math.cos(world.yaw))
    right.set(Math.cos(world.yaw), 0, -Math.sin(world.yaw))
    want.set(0, 0, 0)
    for (const k of world.keys) {
      const m = MOVE_KEYS[k]
      if (m) want.addScaledVector(right, m[0]).addScaledVector(fwd, m[1])
    }
    if (want.lengthSq() === 0 && world.target) {
      want.copy(world.target).sub(p).setY(0)
      if (want.length() < 0.15) {
        world.target = null
        want.set(0, 0, 0)
      }
    }

    const speed = world.keys.has('shift') ? 10 : 6
    world.moving = want.lengthSq() > 0
    if (world.moving) {
      want.normalize()
      p.addScaledVector(want, speed * dt)
      const face = Math.atan2(want.x, want.z)
      if (body.current) {
        let d = face - body.current.rotation.y
        d = Math.atan2(Math.sin(d), Math.cos(d))
        body.current.rotation.y += d * Math.min(1, dt * 12)
      }
    }

    // Bump gently off tree trunks and stay on the island.
    for (const t of world.trees) {
      tmp.set(p.x - t.x, 0, p.z - t.z)
      const d = tmp.length()
      if (d < 0.9 && d > 0.0001) p.addScaledVector(tmp.normalize(), 0.9 - d)
    }
    const fromCenter = Math.hypot(p.x, p.z)
    if (fromCenter > ISLAND_RADIUS) p.multiplyScalar(ISLAND_RADIUS / fromCenter)

    const t = state.clock.elapsedTime
    if (body.current) {
      body.current.position.set(p.x, world.moving ? Math.abs(Math.sin(t * 12)) * 0.12 : 0, p.z)
    }
    const swing = world.moving ? Math.sin(t * 12) * 0.22 : 0
    if (footL.current) footL.current.position.z = swing
    if (footR.current) footR.current.position.z = -swing

    // Camera follows from behind.
    const camTarget = tmp.set(
      p.x + Math.sin(world.yaw) * world.distance,
      world.distance * 0.4 + 1.6,
      p.z + Math.cos(world.yaw) * world.distance,
    )
    camera.position.lerp(camTarget, Math.min(1, dt * 5))
    camera.lookAt(p.x, 2.2, p.z)

    // Let the UI know when we are standing next to a tree.
    let best: string | null = null
    let bestD = 3.2
    for (const tr of world.trees) {
      const d = Math.hypot(p.x - tr.x, p.z - tr.z)
      if (d < bestD) {
        bestD = d
        best = tr.id
      }
    }
    if (best !== near.current) {
      near.current = best
      onNear(best)
    }
  })

  return (
    <group ref={body}>
      {/* body */}
      <mesh castShadow position={[0, 0.75, 0]}>
        <capsuleGeometry args={[0.32, 0.5, 4, 10]} />
        <meshStandardMaterial color="#4f8fd6" roughness={0.6} />
      </mesh>
      {/* overalls strap */}
      <mesh castShadow position={[0, 0.6, 0.02]}>
        <capsuleGeometry args={[0.335, 0.25, 4, 10]} />
        <meshStandardMaterial color="#2f5d8a" roughness={0.7} />
      </mesh>
      {/* head */}
      <mesh castShadow position={[0, 1.42, 0]}>
        <sphereGeometry args={[0.3, 16, 12]} />
        <meshStandardMaterial color="#f5c9a0" roughness={0.6} />
      </mesh>
      {/* eyes */}
      <mesh position={[0.1, 1.46, 0.27]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshStandardMaterial color="#2b1a0e" />
      </mesh>
      <mesh position={[-0.1, 1.46, 0.27]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshStandardMaterial color="#2b1a0e" />
      </mesh>
      {/* straw hat */}
      <mesh castShadow position={[0, 1.66, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.05, 20]} />
        <meshStandardMaterial color="#e9c46a" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.26, 16]} />
        <meshStandardMaterial color="#e9c46a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.72, 0]}>
        <cylinderGeometry args={[0.285, 0.285, 0.06, 16]} />
        <meshStandardMaterial color="#e8574a" />
      </mesh>
      {/* feet */}
      <mesh ref={footL} castShadow position={[0.15, 0.1, 0]}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshStandardMaterial color="#5b3a1e" />
      </mesh>
      <mesh ref={footR} castShadow position={[-0.15, 0.1, 0]}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshStandardMaterial color="#5b3a1e" />
      </mesh>
    </group>
  )
}
