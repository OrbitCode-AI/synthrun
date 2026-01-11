/**
 * Ship preview, shared utilities, and game ship creation
 */
import * as THREE from 'three'
import { useRef, useCallback, useState, useEffect } from 'preact/hooks'
import { SHIP_KEYS } from './Keyboard'
import LightboxViewer from './Lightbox'
import { SHIPS, loadShipModel, getShipConfig, type ShipConfig } from './Ships'
import './styles.css'

// ============================================================================
// SHARED CONSTANTS
// ============================================================================

export const MOVEMENT = {
  accel: 35,
  friction: 0.92,
  xLimit: 3,
  yLimit: 1.5,
  xMax: 8,
  yMax: 5,
}

// ============================================================================
// SHARED UTILITIES
// ============================================================================

// Create fallback cone geometry (shown while model loads)
export function createFallbackCone(preview = false): THREE.Mesh {
  const material = preview
    ? new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x001111, metalness: 1.0, roughness: 0.1 })
    : new THREE.MeshBasicMaterial({ color: 0x00ffff })
  const fallback = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 8), material)
  fallback.rotation.x = preview ? -Math.PI / 2 : Math.PI / 2
  return fallback
}

// Create ship glow light with config-based intensity
export function createShipLight(config: ShipConfig, scene: THREE.Scene): THREE.PointLight {
  const intensity = config.shipLightIntensity ?? 2.0
  const light = new THREE.PointLight(0xff00ff, intensity, 5)
  light.position.set(0, 0, 0)
  scene.add(light)
  return light
}

// Update movement physics (shared between preview, picker, game)
export function updateMovement(
  keys: { left: boolean, right: boolean, up: boolean, down: boolean },
  velocity: { x: number, y: number },
  delta: number
): void {
  const accel = delta * MOVEMENT.accel
  if (keys.left && !keys.right) velocity.x = Math.max(-MOVEMENT.xMax, velocity.x - accel)
  else if (keys.right && !keys.left) velocity.x = Math.min(MOVEMENT.xMax, velocity.x + accel)
  else velocity.x *= MOVEMENT.friction

  if (keys.up && !keys.down) velocity.y = Math.min(MOVEMENT.yMax, velocity.y + accel * 0.5)
  else if (keys.down && !keys.up) velocity.y = Math.max(-MOVEMENT.yMax, velocity.y - accel * 0.5)
  else velocity.y *= MOVEMENT.friction
}

// Apply position and tilt to ship
export function applyMovement(
  ship: THREE.Group,
  velocity: { x: number, y: number },
  delta: number,
  baseRotationY = 0
): void {
  ship.position.x += velocity.x * delta
  ship.position.y += velocity.y * delta
  ship.position.x = Math.max(-MOVEMENT.xLimit, Math.min(MOVEMENT.xLimit, ship.position.x))
  ship.position.y = Math.max(-MOVEMENT.yLimit, Math.min(MOVEMENT.yLimit, ship.position.y))

  // Tilt into turns (negative = same direction as movement)
  // For rotating preview, transform screen-relative tilt to local space
  if (baseRotationY !== 0) {
    const cos = Math.cos(baseRotationY)
    const sin = Math.sin(baseRotationY)
    const screenTiltZ = -velocity.x * 0.08
    const screenTiltX = -velocity.y * 0.1
    ship.rotation.z = screenTiltZ * cos + screenTiltX * sin
    ship.rotation.x = -screenTiltZ * sin + screenTiltX * cos
  } else {
    ship.rotation.z = -velocity.x * 0.08
    ship.rotation.x = -velocity.y * 0.1
  }
}

// ============================================================================
// ANIMATION UTILITIES
// ============================================================================

export interface AnimationState {
  animations: THREE.AnimationClip[]
  mixer: THREE.AnimationMixer | null
  currentAction: THREE.AnimationAction | null
  currentIndex: number
}

// Play animation by index (-1 = stop all)
export function playAnimation(
  state: AnimationState,
  index: number
): string | null {
  if (!state.mixer) return null

  // Stop current animation
  if (state.currentAction) {
    state.currentAction.stop()
    state.currentAction = null
  }

  state.currentIndex = index

  if (index >= 0 && index < state.animations.length) {
    const clip = state.animations[index]
    state.currentAction = state.mixer.clipAction(clip)
    state.currentAction.play()
    return clip.name || `Animation ${index + 1}`
  }
  return null
}

// Cycle animation forward or backward
export function cycleAnimation(state: AnimationState, forward: boolean): string | null {
  const count = state.animations.length
  if (count === 0) return null

  let newIndex = state.currentIndex
  if (forward) {
    newIndex = newIndex >= count - 1 ? -1 : newIndex + 1
  } else {
    newIndex = newIndex <= -1 ? count - 1 : newIndex - 1
  }
  return playAnimation(state, newIndex)
}

// ============================================================================
// SHIP PREVIEW COMPONENT
// ============================================================================

// Standalone preview - 3D ship viewer with cycling and controls
export default function Ship() {
  const shipGroupRef = useRef<THREE.Group | null>(null)
  const shipLightRef = useRef<THREE.PointLight | null>(null)
  const keysRef = useRef({ left: false, right: false, up: false, down: false })
  const velocityRef = useRef({ x: 0, y: 0 })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [animationName, setAnimationName] = useState<string | null>(null)

  // Animation state
  const animStateRef = useRef<AnimationState>({
    animations: [],
    mixer: null,
    currentAction: null,
    currentIndex: -1,
  })

  // Load ship model when index changes
  useEffect(() => {
    const ship = shipGroupRef.current
    const shipLight = shipLightRef.current
    if (!ship) return

    // Reset animation state
    const animState = animStateRef.current
    animState.animations = []
    animState.mixer = null
    animState.currentAction = null
    animState.currentIndex = -1
    setAnimationName(null)

    const config = SHIPS[currentIndex]
    loadShipModel(config, ship, true, (result) => {
      animState.animations = result.animations
      animState.mixer = result.mixer
    })

    // Update light intensity for new ship
    if (shipLight) {
      shipLight.intensity = config.shipLightIntensity ?? 2.0
    }
  }, [currentIndex])

  const handleSetup = useCallback(({ scene }: { scene: THREE.Scene }) => {
    // Create ship group - rotated to face away from camera
    const ship = new THREE.Group()
    ship.rotation.y = Math.PI
    scene.add(ship)
    shipGroupRef.current = ship

    // Add fallback cone
    ship.add(createFallbackCone(true))

    // Ship glow light
    const shipLight = createShipLight(SHIPS[0], scene)
    shipLightRef.current = shipLight

    // Load initial ship
    loadShipModel(SHIPS[0], ship, true, (result) => {
      const animState = animStateRef.current
      animState.animations = result.animations
      animState.mixer = result.mixer
    })

    // Keyboard controls
    const keys = keysRef.current
    const onKeyDown = (e: KeyboardEvent) => {
      // Movement
      if (SHIP_KEYS.left.includes(e.key)) keys.left = true
      if (SHIP_KEYS.right.includes(e.key)) keys.right = true
      if (SHIP_KEYS.up.includes(e.key)) keys.up = true
      if (SHIP_KEYS.down.includes(e.key)) keys.down = true

      // Ship cycling
      const num = parseInt(e.key)
      if (num >= 1 && num <= Math.min(8, SHIPS.length)) {
        setCurrentIndex(num - 1)
      } else if (e.key === '[') {
        setCurrentIndex(i => (i - 1 + SHIPS.length) % SHIPS.length)
      } else if (e.key === ']') {
        setCurrentIndex(i => (i + 1) % SHIPS.length)
      }

      // Animation cycling
      if (e.key === 'm' || e.key === 'M') {
        const name = cycleAnimation(animStateRef.current, true)
        setAnimationName(name)
        if (name) setTimeout(() => setAnimationName(null), 2000)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (SHIP_KEYS.left.includes(e.key)) keys.left = false
      if (SHIP_KEYS.right.includes(e.key)) keys.right = false
      if (SHIP_KEYS.up.includes(e.key)) keys.up = false
      if (SHIP_KEYS.down.includes(e.key)) keys.down = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
  }, [])

  const handleAnimate = useCallback((_context: unknown, delta: number, time: number) => {
    const ship = shipGroupRef.current
    const shipLight = shipLightRef.current
    if (!ship) return

    // Slow rotation (10 seconds per revolution)
    const rotY = time * (Math.PI * 2) / 10
    ship.rotation.y = rotY

    // Update movement physics
    updateMovement(keysRef.current, velocityRef.current, delta)
    applyMovement(ship, velocityRef.current, delta, rotY)

    // Update ship light position
    if (shipLight) shipLight.position.copy(ship.position)

    // Update animation mixer
    if (animStateRef.current.mixer) {
      animStateRef.current.mixer.update(delta)
    }
  }, [])

  const currentShip = SHIPS[currentIndex]

  return (
    <LightboxViewer onSetup={handleSetup} onAnimate={handleAnimate}>
      <div className="picker-info">
        <div className="picker-ship-name">{currentShip.name}</div>
        {currentShip.credit && (
          <div className="picker-credit">
            <a href={currentShip.creditUrl} target="_blank" rel="noopener">
              {currentShip.credit}
            </a>
            {' by '}
            <a href={currentShip.authorUrl} target="_blank" rel="noopener">
              {currentShip.author}
            </a>
            {' ('}{currentShip.license}{')'}
          </div>
        )}
        {animationName && (
          <div className="picker-animation-name">{animationName}</div>
        )}
      </div>
      <div className="picker-footer">
        <div className="picker-dots">
          {SHIPS.map((ship, i) => (
            <span
              key={ship.id}
              className={`picker-dot ${i === currentIndex ? 'active' : ''}`}
            />
          ))}
        </div>
        <div className="picker-controls">
          [/] or 1-8 ships • M anims • WASD fly
        </div>
      </div>
    </LightboxViewer>
  )
}

// ============================================================================
// GAME SHIP FACTORY
// ============================================================================

// Create player ship with glow light for the game
export function createShip(
  scene: THREE.Scene,
  shipConfig?: ShipConfig,
  animationIndex = -1,
  onLoad?: (result: { animations: THREE.AnimationClip[], mixer: THREE.AnimationMixer | null, action: THREE.AnimationAction | null }) => void
) {
  const config = shipConfig || SHIPS[0]

  // Create a group to hold the ship
  const ship = new THREE.Group()
  ship.position.set(0, 0.3, 3)
  scene.add(ship)

  // Add fallback cone (game style)
  ship.add(createFallbackCone(false))

  // Mixer reference to be set when model loads
  let mixer: THREE.AnimationMixer | null = null

  // Load the ship model and set up animation
  loadShipModel(config, ship, false, (result) => {
    mixer = result.mixer
    let action: THREE.AnimationAction | null = null
    if (mixer && animationIndex >= 0 && result.animations[animationIndex]) {
      action = mixer.clipAction(result.animations[animationIndex])
      action.play()
    }
    onLoad?.({ animations: result.animations, mixer, action })
  })

  // Create ship light with config intensity
  const shipLight = createShipLight(config, scene)
  shipLight.position.copy(ship.position)

  // Return a getter for mixer since it's set async, and config for lighting
  return {
    ship,
    shipLight,
    config,
    get mixer() { return mixer }
  }
}

