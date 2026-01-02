/**
 * Obstacle generation with level progression and funnel patterns
 */
import * as THREE from 'three'
import { useEffect, useRef } from 'preact/hooks'
import { applySceneConfig } from './Scene'

// Standalone preview - shows obstacle spawning with accelerated level progression
export default function Obstacles() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150)
    camera.position.set(0, 2, 5)
    camera.lookAt(0, 0, -10)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    applySceneConfig(scene, renderer)
    containerRef.current.appendChild(renderer.domElement)

    // Ground plane for reference
    const gridHelper = new THREE.GridHelper(100, 50, 0x333333, 0x222222)
    scene.add(gridHelper)

    // Obstacle state - accelerated distance for demo (~10 sec levels)
    const DEMO_LEVEL_DISTANCE = 110   // Shorter level for demo
    const DEMO_FUNNEL_DISTANCE = 20   // Shorter funnel for demo
    const DEMO_SPAWN_INTERVAL = 5
    const DEMO_FUNNEL_SPAWN_INTERVAL = 2
    const cubes: THREE.Mesh[] = []
    let state = createObstacleState(0)
    let speed = getLevelSpeed(1)

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // Animation loop
    const clock = new THREE.Clock()
    let animationId: number

    function animate() {
      const delta = clock.getDelta()

      // Update distance traveled (speed * 15 matches cube movement)
      const distanceDelta = delta * speed * 15
      state.distance += distanceDelta

      // Spawn obstacles based on distance
      const phaseDistance = state.distance - state.phaseStartDistance
      const color = getLevelColor(state.level)

      if (state.phase === 'normal') {
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
      } else {
        state.funnelProgress = phaseDistance / DEMO_FUNNEL_DISTANCE
        if (phaseDistance >= DEMO_FUNNEL_DISTANCE) {
          state.level = (state.level % LEVEL_COLORS.length) + 1
          state.phase = 'normal'
          state.phaseStartDistance = state.distance
          state.funnelProgress = 0
          state.nextSpawnDistance = state.distance + DEMO_SPAWN_INTERVAL
          speed = getLevelSpeed(state.level)
        } else if (state.distance >= state.nextSpawnDistance) {
          const FULL_WIDTH = 8
          const MIN_GAP = 2.4
          const gapHalf = FULL_WIDTH - state.funnelProgress * (FULL_WIDTH - MIN_GAP / 2)
          for (let x = -FULL_WIDTH; x <= FULL_WIDTH; x += 1.5) {
            if (x < -gapHalf || x > gapHalf) {
              cubes.push(createObstacle(scene, x, color))
            }
          }
          state.nextSpawnDistance = state.distance + DEMO_FUNNEL_SPAWN_INTERVAL
        }
      }

      // Update cubes
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
      <p style={{
        position: 'absolute', bottom: 20, left: 20,
        color: '#666', fontFamily: 'monospace', fontSize: 14,
        pointerEvents: 'none',
      }}>
        Obstacle preview (distance-based, accelerated levels)
      </p>
    </div>
  )
}

// Level colors: red → orange → yellow → bright green → cyan → white
export const LEVEL_COLORS = [
  0xff2244,  // Level 1: Red-pink (less magenta to differentiate from sun)
  0xff6600,  // Level 2: Orange
  0xffff00,  // Level 3: Yellow
  0x00ff00,  // Level 4: Bright green
  0x00ffff,  // Level 5: Cyan
  0xffffff,  // Level 6+: White
]

// Distance constants (in world units traveled)
// At speed 0.5, distance/sec = 7.5; at speed 1.0, distance/sec = 15
// Average ~11 units/sec during level 1, so 660 units ≈ 60 seconds
const LEVEL_DISTANCE = 660       // Distance of normal play before funnel (~60 sec)
const FUNNEL_DISTANCE = 55       // Distance of funnel pattern (~5 sec)
const SPAWN_INTERVAL = 5         // Distance between random obstacle spawns (~0.5 sec)
const FUNNEL_SPAWN_INTERVAL = 2  // Distance between funnel wall spawns

export interface ObstacleState {
  level: number
  phase: 'normal' | 'funnel'
  phaseStartDistance: number
  nextSpawnDistance: number
  distance: number              // Total distance traveled
  funnelProgress: number        // 0-1, how far through funnel we are
}

/**
 * Create initial obstacle state
 */
export function createObstacleState(_startTime: number): ObstacleState {
  return {
    level: 1,
    phase: 'normal',
    phaseStartDistance: 0,
    nextSpawnDistance: 15,  // Initial delay before first obstacle
    distance: 0,
    funnelProgress: 0,
  }
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
 * Create a single obstacle cube
 */
export function createObstacle(
  scene: THREE.Scene,
  x: number,
  color: number
): THREE.Mesh {
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  )
  cube.position.set(x, 0.5, -40)
  cube.userData.passed = false
  scene.add(cube)
  return cube
}

/**
 * Spawn obstacles based on distance traveled
 * Returns array of new obstacles and updated state
 */
export function spawnObstacles(
  scene: THREE.Scene,
  state: ObstacleState,
  delta: number,
  currentSpeed: number
): { obstacles: THREE.Mesh[], newState: ObstacleState, newSpeed: number } {
  const obstacles: THREE.Mesh[] = []
  let newState = { ...state }
  let newSpeed = currentSpeed

  // Update distance traveled (speed * 15 matches cube movement in updateObstacles)
  const distanceDelta = delta * currentSpeed * 15
  newState.distance = state.distance + distanceDelta

  const phaseDistance = newState.distance - state.phaseStartDistance
  const color = getLevelColor(state.level)

  if (state.phase === 'normal') {
    // Check if it's time to start funnel
    if (phaseDistance >= LEVEL_DISTANCE) {
      newState.phase = 'funnel'
      newState.phaseStartDistance = newState.distance
      newState.funnelProgress = 0
      newState.nextSpawnDistance = newState.distance
    } else if (newState.distance >= state.nextSpawnDistance) {
      // Random spawn across full width
      const x = (Math.random() - 0.5) * 16
      obstacles.push(createObstacle(scene, x, color))
      newState.nextSpawnDistance = newState.distance + SPAWN_INTERVAL + Math.random() * SPAWN_INTERVAL
      // Gradually increase speed during normal phase
      newSpeed = Math.min(getLevelSpeed(state.level) + 0.5, currentSpeed + 0.01)
    }
  } else {
    // Funnel phase
    newState.funnelProgress = phaseDistance / FUNNEL_DISTANCE

    if (phaseDistance >= FUNNEL_DISTANCE) {
      // End funnel, start new level
      newState.level = state.level + 1
      newState.phase = 'normal'
      newState.phaseStartDistance = newState.distance
      newState.funnelProgress = 0
      newState.nextSpawnDistance = newState.distance + SPAWN_INTERVAL
      newSpeed = getLevelSpeed(newState.level)
    } else if (newState.distance >= state.nextSpawnDistance) {
      // Spawn funnel pattern - walls that close in toward center
      const progress = newState.funnelProgress

      // Gap narrows from full width to 3x ship width (2.4)
      const FULL_WIDTH = 8  // ±8 = 16 total playable width
      const MIN_GAP = 2.4   // 3x ship collision width (0.8)
      const gapHalf = (FULL_WIDTH - progress * (FULL_WIDTH - MIN_GAP / 2))

      // Spawn cubes on left and right walls
      const cubeSpacing = 1.5
      for (let x = -FULL_WIDTH; x <= FULL_WIDTH; x += cubeSpacing) {
        // Skip the center gap
        if (x < -gapHalf || x > gapHalf) {
          obstacles.push(createObstacle(scene, x, color))
        }
      }

      newState.nextSpawnDistance = newState.distance + FUNNEL_SPAWN_INTERVAL
    }
  }

  return { obstacles, newState, newSpeed }
}

/**
 * Update existing obstacles (movement, rotation, cleanup)
 * Returns score delta and whether any collision occurred
 */
export function updateObstacles(
  scene: THREE.Scene,
  cubes: THREE.Mesh[],
  shipX: number,
  delta: number,
  speed: number,
  onScore: (delta: number) => void
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
      onScore(10)
    }

    // Collision detection
    if (cube.position.z > 2 && cube.position.z < 4 &&
        Math.abs(cube.position.x - shipX) < 0.8) {
      collision = true
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
export function clearObstacles(scene: THREE.Scene, cubes: THREE.Mesh[]) {
  cubes.forEach(c => scene.remove(c))
  cubes.length = 0
}
