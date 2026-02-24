/**
 * Obstacle generation with level progression and funnel patterns
 */
import * as three from './three'
import { useEffect, useRef } from 'react'
import { applySceneConfig } from './Scene'

// Standalone preview - shows obstacle spawning with accelerated level progression
export default function Obstacles() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new three.Scene()
    const camera = new three.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150)
    camera.position.set(0, 2, 5)
    camera.lookAt(0, 0, -10)

    const renderer = new three.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    applySceneConfig(scene, renderer)
    containerRef.current.appendChild(renderer.domElement)

    // Ground plane for reference
    const gridHelper = new three.GridHelper(100, 50, 0x333333, 0x222222)
    scene.add(gridHelper)

    // Obstacle state - accelerated distance for demo (~10 sec levels)
    const DEMO_LEVEL_DISTANCE = 110 // Shorter level for demo
    const DEMO_FUNNEL_DISTANCE = 20 // Shorter funnel for demo
    const DEMO_SPAWN_INTERVAL = 5
    const DEMO_FUNNEL_SPAWN_INTERVAL = 2
    const cubes: three.Mesh[] = []
    const state = createObstacleState(0)
    let speed = getLevelSpeed(1)

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // Animation loop
    const timer = new three.Timer()
    // Handle normal phase spawning
    const updateNormalPhase = (phaseDistance: number, color: number) => {
      if (phaseDistance >= DEMO_LEVEL_DISTANCE) {
        state.phase = 'funnel'
        state.phaseStartDistance = state.distance
        state.funnelProgress = 0
        state.nextSpawnDistance = state.distance
      } else if (state.distance >= state.nextSpawnDistance) {
        const x = (Math.random() - 0.5) * 16
        cubes.push(createObstacle(scene, x, color))
        state.nextSpawnDistance = state.distance + DEMO_SPAWN_INTERVAL
      }
    }

    // Handle funnel phase spawning
    const updateFunnelPhase = (phaseDistance: number, color: number) => {
      state.funnelProgress = phaseDistance / DEMO_FUNNEL_DISTANCE
      if (phaseDistance >= DEMO_FUNNEL_DISTANCE) {
        state.level = (state.level % LEVEL_COLORS.length) + 1
        state.phase = 'normal'
        state.phaseStartDistance = state.distance
        state.funnelProgress = 0
        state.nextSpawnDistance = state.distance + DEMO_SPAWN_INTERVAL
        speed = getLevelSpeed(state.level)
      } else if (state.distance >= state.nextSpawnDistance) {
        spawnFunnelWalls(scene, cubes, state.funnelProgress, color)
        state.nextSpawnDistance = state.distance + DEMO_FUNNEL_SPAWN_INTERVAL
      }
    }

    // Move and clean up cubes
    const updateDemoCubes = (delta: number) => {
      for (let i = cubes.length - 1; i >= 0; i--) {
        const cube = cubes[i]
        cube.position.z += delta * speed * 15
        cube.rotation.x += delta
        cube.rotation.y += delta * 0.5
        if (cube.position.z > 10) {
          scene.remove(cube)
          cubes.splice(i, 1)
        }
      }
    }

    let animationId: number

    function animate() {
      timer.update()
      const delta = timer.getDelta()

      // Update distance traveled (speed * 15 matches cube movement)
      state.distance += delta * speed * 15

      // Spawn obstacles based on distance
      const phaseDistance = state.distance - state.phaseStartDistance
      const color = getLevelColor(state.level)

      if (state.phase === 'normal') updateNormalPhase(phaseDistance, color)
      else updateFunnelPhase(phaseDistance, color)

      updateDemoCubes(delta)

      renderer.render(scene, camera)
      animationId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0 }}>
      <p
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          color: '#666',
          fontFamily: 'monospace',
          fontSize: 14,
          pointerEvents: 'none',
        }}>
        Obstacle preview (distance-based, accelerated levels)
      </p>
    </div>
  )
}

// Level colors: red → orange → yellow → green → blue → white
export const LEVEL_COLORS = [
  0xff2244, // Level 1: Red-pink
  0xff6600, // Level 2: Orange
  0xffff00, // Level 3: Yellow
  0x00ff00, // Level 4: Green
  0x0088ff, // Level 5: Blue
  0xffffff, // Level 6+: White
]

// Distance constants (in world units traveled)
// At speed 0.5, distance/sec = 7.5; at speed 1.0, distance/sec = 15
// Average ~11 units/sec during level 1, so 660 units ≈ 60 seconds
const LEVEL_DISTANCE = 660 // Distance of normal play before funnel (~60 sec)
const FUNNEL_DISTANCE = 55 // Distance of funnel pattern (~5 sec)
const SPAWN_INTERVAL = 5 // Distance between random obstacle spawns (~0.5 sec)
const FUNNEL_SPAWN_INTERVAL = 2 // Distance between funnel wall spawns

// Level 2 constants
const LEVEL2_LOW_Y = 1.5 // Low corridor obstacle row
const LEVEL2_HIGH_Y = 5.0 // High corridor obstacle row
const LEVEL2_SPAWN_INTERVAL = 3 // Denser than L1's 5-10
const LEVEL2_DISTANCE = 1500 // World units before funnel/victory
const LEVEL2_FUNNEL_DISTANCE = 55
const LEVEL2_FUNNEL_SPAWN_INTERVAL = 1.5

export interface ObstacleState {
  level: number
  phase: 'normal' | 'funnel'
  phaseStartDistance: number
  nextSpawnDistance: number
  distance: number // Total distance traveled
  funnelProgress: number // 0-1, how far through funnel we are
  majorLevel: number // 1 = camera altitude, 2 = free-fly, 3 = victory sentinel
  level2Distance: number // Distance traveled in Level 2
}

/**
 * Create initial obstacle state
 */
export function createObstacleState(_startTime: number): ObstacleState {
  return {
    level: 1,
    phase: 'normal',
    phaseStartDistance: 0,
    nextSpawnDistance: 15, // Initial delay before first obstacle
    distance: 0,
    funnelProgress: 0,
    majorLevel: 1,
    level2Distance: 0,
  }
}

/**
 * Get Level 1 progress (0→1) based on sub-level and phase progress.
 * Used by Game.tsx to compute max camera altitude.
 */
export function getLevel1Progress(state: ObstacleState): number {
  if (state.majorLevel !== 1) return 1
  const phaseDistance = state.distance - state.phaseStartDistance
  const totalPhaseDistance = state.phase === 'normal' ? LEVEL_DISTANCE : FUNNEL_DISTANCE
  const phaseProgress = Math.min(1, phaseDistance / totalPhaseDistance)
  return Math.min(1, (state.level - 1 + phaseProgress) / 6)
}

/**
 * Get color for current level
 */
export function getLevelColor(level: number): number {
  const index = Math.min(level - 1, LEVEL_COLORS.length - 1)
  return LEVEL_COLORS[index]
}

/**
 * Get base speed for current level
 */
export function getLevelSpeed(level: number): number {
  // Start at 0.5, increase by 0.3 per level, cap at 3.0
  return Math.min(3.0, 0.5 + (level - 1) * 0.3)
}

/**
 * Spawn funnel wall obstacles with a center gap based on progress
 */
function spawnFunnelWalls(
  scene: three.Scene,
  target: three.Mesh[],
  progress: number,
  color: number,
): void {
  const FULL_WIDTH = 8
  const MIN_GAP = 2.4
  const gapHalf = FULL_WIDTH - progress * (FULL_WIDTH - MIN_GAP / 2)
  const cubeSpacing = 1.5
  for (let x = -FULL_WIDTH; x <= FULL_WIDTH; x += cubeSpacing) {
    if (x < -gapHalf || x > gapHalf) {
      target.push(createObstacle(scene, x, color))
    }
  }
}

/**
 * Height constants for obstacles
 */
export const OBSTACLE_GROUND_Y = 0.5 // Ground-level obstacle center Y
export const OBSTACLE_HIGH_Y = 3.0 // High obstacle center Y (jump height)
/**
 * Create a single obstacle cube (ground or high)
 */
export function createObstacle(
  scene: three.Scene,
  x: number,
  color: number,
  high = false,
  yOverride?: number,
): three.Mesh {
  const cube = new three.Mesh(
    new three.BoxGeometry(1, 1, 1),
    new three.MeshBasicMaterial({ color, transparent: true, opacity: high ? 0.7 : 0.9 }),
  )
  const y = yOverride !== undefined ? yOverride : high ? OBSTACLE_HIGH_Y : OBSTACLE_GROUND_Y
  cube.position.set(x, y, -40)
  cube.userData.passed = false
  cube.userData.high = high
  scene.add(cube)
  return cube
}

/**
 * Spawn funnel walls at both Y rows for Level 2
 */
function spawnLevel2FunnelWalls(
  scene: three.Scene,
  target: three.Mesh[],
  progress: number,
  color: number,
): void {
  const FULL_WIDTH = 8
  const MIN_GAP = 2.4
  const gapHalf = FULL_WIDTH - progress * (FULL_WIDTH - MIN_GAP / 2)
  const cubeSpacing = 1.5
  for (let x = -FULL_WIDTH; x <= FULL_WIDTH; x += cubeSpacing) {
    if (x < -gapHalf || x > gapHalf) {
      target.push(createObstacle(scene, x, color, false, LEVEL2_LOW_Y))
      target.push(createObstacle(scene, x, color, false, LEVEL2_HIGH_Y))
    }
  }
}

/**
 * Spawn Level 2 obstacles (two-row corridor)
 */
function spawnLevel2Obstacles(
  scene: three.Scene,
  state: ObstacleState,
  obstacles: three.Mesh[],
  distanceDelta: number,
): { newState: ObstacleState; newSpeed: number } {
  const newState = { ...state }
  newState.distance = state.distance + distanceDelta
  newState.level2Distance = state.level2Distance + distanceDelta

  const randomColor = () => LEVEL_COLORS[Math.floor(Math.random() * LEVEL_COLORS.length)]

  if (state.phase === 'normal') {
    if (newState.level2Distance >= LEVEL2_DISTANCE) {
      newState.phase = 'funnel'
      newState.phaseStartDistance = newState.distance
      newState.funnelProgress = 0
      newState.nextSpawnDistance = newState.distance
    } else if (newState.distance >= state.nextSpawnDistance) {
      const x = (Math.random() - 0.5) * 16
      const yRow = Math.random() < 0.5 ? LEVEL2_LOW_Y : LEVEL2_HIGH_Y
      obstacles.push(createObstacle(scene, x, randomColor(), false, yRow))
      newState.nextSpawnDistance = newState.distance + LEVEL2_SPAWN_INTERVAL
    }
  } else {
    const phaseDistance = newState.distance - state.phaseStartDistance
    newState.funnelProgress = phaseDistance / LEVEL2_FUNNEL_DISTANCE
    if (phaseDistance >= LEVEL2_FUNNEL_DISTANCE) {
      newState.majorLevel = 3 // Victory sentinel
    } else if (newState.distance >= state.nextSpawnDistance) {
      spawnLevel2FunnelWalls(scene, obstacles, newState.funnelProgress, randomColor())
      newState.nextSpawnDistance = newState.distance + LEVEL2_FUNNEL_SPAWN_INTERVAL
    }
  }

  return { newState, newSpeed: 2.0 }
}

/**
 * Spawn obstacles based on distance traveled
 * Returns array of new obstacles and updated state
 */
export function spawnObstacles(
  scene: three.Scene,
  state: ObstacleState,
  delta: number,
  currentSpeed: number,
): { obstacles: three.Mesh[]; newState: ObstacleState; newSpeed: number } {
  const obstacles: three.Mesh[] = []
  const distanceDelta = delta * currentSpeed * 15

  // Level 2: two-row corridor spawning
  if (state.majorLevel === 2) {
    const result = spawnLevel2Obstacles(scene, state, obstacles, distanceDelta)
    return { obstacles, ...result }
  }

  // Level 1: existing logic
  const newState = { ...state }
  let newSpeed = currentSpeed

  newState.distance = state.distance + distanceDelta

  const phaseDistance = newState.distance - state.phaseStartDistance
  const color = getLevelColor(state.level)

  if (state.phase === 'normal') {
    if (phaseDistance >= LEVEL_DISTANCE) {
      newState.phase = 'funnel'
      newState.phaseStartDistance = newState.distance
      newState.funnelProgress = 0
      newState.nextSpawnDistance = newState.distance
    } else if (newState.distance >= state.nextSpawnDistance) {
      const x = (Math.random() - 0.5) * 16
      obstacles.push(createObstacle(scene, x, color))
      newState.nextSpawnDistance =
        newState.distance + SPAWN_INTERVAL + Math.random() * SPAWN_INTERVAL
      newSpeed = Math.min(getLevelSpeed(state.level) + 0.5, currentSpeed + 0.01)
    }
  } else {
    newState.funnelProgress = phaseDistance / FUNNEL_DISTANCE
    if (phaseDistance >= FUNNEL_DISTANCE) {
      newState.level = state.level + 1
      newState.phase = 'normal'
      newState.phaseStartDistance = newState.distance
      newState.funnelProgress = 0
      newState.nextSpawnDistance = newState.distance + SPAWN_INTERVAL
      newSpeed = getLevelSpeed(newState.level)
      // Transition to Level 2 after sub-level 6
      if (newState.level > 6) {
        newState.majorLevel = 2
        newState.level2Distance = 0
        newState.phase = 'normal'
        newState.phaseStartDistance = newState.distance
        newState.nextSpawnDistance = newState.distance + LEVEL2_SPAWN_INTERVAL
        newState.funnelProgress = 0
        newSpeed = 2.0
      }
    } else if (newState.distance >= state.nextSpawnDistance) {
      spawnFunnelWalls(scene, obstacles, newState.funnelProgress, color)
      newState.nextSpawnDistance = newState.distance + FUNNEL_SPAWN_INTERVAL
    }
  }

  return { obstacles, newState, newSpeed }
}

/**
 * Update existing obstacles (movement, rotation, cleanup)
 * Returns score delta and whether any collision occurred
 * shipY is the ship's current Y position (for jump collision checks)
 */
export function updateObstacles(
  scene: three.Scene,
  cubes: three.Mesh[],
  shipX: number,
  shipY: number,
  delta: number,
  speed: number,
  onScore: (delta: number) => void,
): boolean {
  let collision = false

  for (let i = cubes.length - 1; i >= 0; i--) {
    const cube = cubes[i]
    cube.position.z += delta * speed * 15
    cube.rotation.x += delta
    cube.rotation.y += delta * 0.5

    // Score when passed
    if (!cube.userData.passed && cube.position.z > 4) {
      cube.userData.passed = true
      onScore(cube.userData.high ? 20 : 10) // High obstacles worth more
    }

    // Collision detection - check both X and Y proximity
    if (cube.position.z > 2 && cube.position.z < 4 && Math.abs(cube.position.x - shipX) < 0.8) {
      // Check Y collision: ship must be within ~1 unit of obstacle center Y
      if (Math.abs(cube.position.y - shipY) < 1.2) {
        collision = true
      }
    }

    // Remove when past camera
    if (cube.position.z > 10) {
      scene.remove(cube)
      cubes.splice(i, 1)
    }
  }

  return collision
}

/**
 * Clear all obstacles from scene
 */
export function clearObstacles(scene: three.Scene, cubes: three.Mesh[]) {
  for (const c of cubes) {
    scene.remove(c)
  }
  cubes.length = 0
}
