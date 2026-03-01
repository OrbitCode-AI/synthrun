/**
 * Ship preview, shared utilities, and game ship creation
 */
import * as three from 'three'
import { useRef, useCallback, useState } from 'preact/hooks'
import { SHIP_KEYS } from './Keyboard'
import Lightbox from './Lightbox'
import { SHIPS, loadShipModel, type ShipConfig } from './Ships'
import './styles.css'

// ============================================================================
// SHARED CONSTANTS
// ============================================================================

// Index of ship to display in standalone preview (0-based)
export const PREVIEW_SHIP_INDEX = 0

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
export function createFallbackCone(preview = false): three.Mesh {
  const material = preview
    ? new three.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x001111,
        metalness: 1.0,
        roughness: 0.1,
      })
    : new three.MeshBasicMaterial({ color: 0x00ffff })
  const fallback = new three.Mesh(new three.ConeGeometry(0.3, 1, 8), material)
  fallback.rotation.x = preview ? -Math.PI / 2 : Math.PI / 2
  return fallback
}

// Create ship glow light with config-based intensity
export function createShipLight(config: ShipConfig, scene: three.Scene): three.PointLight {
  const intensity = config.shipLightIntensity ?? 2.0
  const light = new three.PointLight(0xff00ff, intensity, 5)
  light.position.set(0, 0, 0)
  scene.add(light)
  return light
}

// Update movement physics (shared between preview, picker, game)
export function updateMovement(
  keys: { left: boolean; right: boolean; up: boolean; down: boolean },
  velocity: { x: number; y: number },
  delta: number,
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
  ship: three.Group,
  velocity: { x: number; y: number },
  delta: number,
  baseRotationY = 0,
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
  animations: three.AnimationClip[]
  mixer: three.AnimationMixer | null
  currentAction: three.AnimationAction | null
  currentIndex: number
}

// Play animation by index (-1 = stop all)
export function playAnimation(state: AnimationState, index: number): string | null {
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

// Apply direction key state from a keyboard event
export function applyDirectionKeyState(
  e: KeyboardEvent,
  keys: { left: boolean; right: boolean; up: boolean; down: boolean },
  state: boolean,
): void {
  if (SHIP_KEYS.left.includes(e.key)) keys.left = state
  if (SHIP_KEYS.right.includes(e.key)) keys.right = state
  if (SHIP_KEYS.up.includes(e.key)) keys.up = state
  if (SHIP_KEYS.down.includes(e.key)) keys.down = state
}

// ============================================================================
// SHIP PREVIEW COMPONENT
// ============================================================================

// Standalone preview - single ship that flies around
export default function Ship() {
  const shipGroupRef = useRef<three.Group | null>(null)
  const shipLightRef = useRef<three.PointLight | null>(null)
  const overheadLightRef = useRef<three.DirectionalLight | null>(null)
  const keysRef = useRef({ left: false, right: false, up: false, down: false })
  const velocityRef = useRef({ x: 0, y: 0 })
  const [animationName, setAnimationName] = useState<string | null>(null)

  // Animation state
  const animStateRef = useRef<AnimationState>({
    animations: [],
    mixer: null,
    currentAction: null,
    currentIndex: -1,
  })

  // Use first ship
  const shipConfig = SHIPS[PREVIEW_SHIP_INDEX]

  const handleSetup = useCallback(
    ({ scene }: { scene: three.Scene }) => {
      // Create ship group - rotated to face away from camera
      const ship = new three.Group()
      ship.rotation.y = Math.PI
      scene.add(ship)
      shipGroupRef.current = ship

      // Add fallback cone
      ship.add(createFallbackCone(true))

      // Ship glow light
      const shipLight = createShipLight(shipConfig, scene)
      shipLightRef.current = shipLight

      // Overhead directional light (same as ShipPicker and Game)
      const overheadIntensity = shipConfig.overheadLightIntensity ?? 0.8
      const overheadLight = new three.DirectionalLight(0xffffff, overheadIntensity)
      overheadLight.position.set(0, 10, 10)
      overheadLight.target = ship
      scene.add(overheadLight)
      overheadLightRef.current = overheadLight

      // Load ship model
      loadShipModel(shipConfig, ship, true, result => {
        const animState = animStateRef.current
        animState.animations = result.animations
        animState.mixer = result.mixer
      })

      // Keyboard controls
      const keys = keysRef.current
      const onKeyDown = (e: KeyboardEvent) => {
        applyDirectionKeyState(e, keys, true)
        if (e.key === 'm' || e.key === 'M') {
          const name = cycleAnimation(animStateRef.current, true)
          setAnimationName(name)
          if (name) setTimeout(() => setAnimationName(null), 2000)
        }
      }
      const onKeyUp = (e: KeyboardEvent) => {
        applyDirectionKeyState(e, keys, false)
      }
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)
    },
    [shipConfig],
  )

  const handleAnimate = useCallback((_context: unknown, delta: number, time: number) => {
    const ship = shipGroupRef.current
    const shipLight = shipLightRef.current
    if (!ship) return

    // Slow rotation (10 seconds per revolution)
    const rotY = (time * (Math.PI * 2)) / 10
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

  return (
    <Lightbox onSetup={handleSetup} onAnimate={handleAnimate}>
      <div className="picker-info">
        <div className="picker-ship-name">{shipConfig.name}</div>
        {shipConfig.credit && (
          <div className="picker-credit">
            <a href={shipConfig.creditUrl} target="_blank" rel="noreferrer noopener">
              {shipConfig.credit}
            </a>
            {' by '}
            <a href={shipConfig.authorUrl} target="_blank" rel="noreferrer noopener">
              {shipConfig.author}
            </a>
            {' ('}
            {shipConfig.license}
            {')'}
          </div>
        )}
        {animationName && <div className="picker-animation-name">{animationName}</div>}
      </div>
      <div className="picker-footer">
        <div className="picker-controls">WASD fly • M anims</div>
      </div>
    </Lightbox>
  )
}

// ============================================================================
// GAME SHIP FACTORY
// ============================================================================

// Create player ship with glow light for the game
export function createShip(
  scene: three.Scene,
  shipConfig?: ShipConfig,
  animationIndex = -1,
  onLoad?: (result: {
    animations: three.AnimationClip[]
    mixer: three.AnimationMixer | null
    action: three.AnimationAction | null
  }) => void,
) {
  const config = shipConfig || SHIPS[0]

  // Create a group to hold the ship
  const ship = new three.Group()
  ship.position.set(0, 0.3, 3)
  scene.add(ship)

  // Add fallback cone (game style)
  ship.add(createFallbackCone(false))

  // Mixer reference to be set when model loads
  let mixer: three.AnimationMixer | null = null

  // Load the ship model and set up animation
  loadShipModel(config, ship, false, result => {
    mixer = result.mixer
    let action: three.AnimationAction | null = null
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
    get mixer() {
      return mixer
    },
  }
}
