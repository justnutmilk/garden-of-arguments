import { Vector3 } from 'three'

// Mutable per-frame state shared by the player, camera and trees.
// Kept outside React so walking around never triggers re-renders.
export const world = {
  player: new Vector3(0, 0, 3),
  target: null as Vector3 | null,
  yaw: 0.6,
  distance: 11,
  trees: [] as { id: string; x: number; z: number }[],
  keys: new Set<string>(),
  moving: false,
}

export const ISLAND_RADIUS = 86

export function walkTo(x: number, z: number, stopShort = 0) {
  const t = new Vector3(x, 0, z)
  if (stopShort > 0) {
    const away = world.player.clone().sub(t).setY(0)
    if (away.lengthSq() < 0.01) away.set(0, 0, 1)
    t.add(away.normalize().multiplyScalar(stopShort))
  }
  world.target = t
}
