/**
 * ShipPicker - Select a ship model before starting the game
 * Uses Lightbox to display ships with spinning lights
 * Controls: WASD/Arrows to fly, [/] to cycle ships, 1-8 for direct select, M for anims, Enter to confirm
 */
import * as THREE from 'three'
import { useRef, useState, useEffect, useCallback } from 'preact/hooks'
import Lightbox from './Lightbox'
import { SHIPS, loadShipModel, type ShipConfig } from './Ships'
import { SHIP_KEYS } from './Keyboard'
import {
  createFallbackCone,
  createShipLight,
  updateMovement,
  applyMovement,
  cycleAnimation,
} from './Ship'
import './styles.css'

interface ShipPickerProps {
  onSelect: (ship: ShipConfig, animationIndex: number) => void
  initialShipId?: string
}

export default function ShipPicker({ onSelect, initialShipId }: ShipPickerProps) {
  // Compute initial index (not using lazy initializer due to shared state handling)
  const initialIndex =
    initialShipId && SHIPS?.length
      ? Math.max(
          0,
          SHIPS.findIndex(s => s.id === initialShipId),
        )
      : 0
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [animationName, setAnimationName] = useState<string | null>(null)
  const shipGroupRef = useRef<THREE.Group | null>(null)
  const shipLightRef = useRef<THREE.PointLight | null>(null)
  const overheadLightRef = useRef<THREE.DirectionalLight | null>(null)
  const keysRef = useRef({ left: false, right: false, up: false, down: false })
  const velocityRef = useRef({ x: 0, y: 0 })

  // Animation state
  const animStateRef = useRef({
    animations: [] as THREE.AnimationClip[],
    mixer: null as THREE.AnimationMixer | null,
    currentAction: null as THREE.AnimationAction | null,
    currentIndex: -1,
  })

  // Derive currentShip (may be undefined if SHIPS not loaded)
  const currentShip = SHIPS?.[currentIndex]

  // Handle keyboard - ship cycling with [/], movement with WASD/arrows, animation with M
  // NOTE: All hooks must be called before any conditional returns (Rules of Hooks)
  useEffect(() => {
    // Skip if no ship selected yet
    if (!currentShip) return
    const keys = keysRef.current

    const onKeyDown = (e: KeyboardEvent) => {
      // Number keys 1-8 for direct selection
      const num = Number.parseInt(e.key)
      if (num >= 1 && num <= Math.min(8, SHIPS.length)) {
        setCurrentIndex(num - 1)
        return
      }

      // [/] for previous/next ship
      if (e.key === '[') {
        setCurrentIndex(i => (i - 1 + SHIPS.length) % SHIPS.length)
      } else if (e.key === ']') {
        setCurrentIndex(i => (i + 1) % SHIPS.length)
      } else if (e.key === 'Enter') {
        onSelect(currentShip, animStateRef.current.currentIndex)
      }

      // M for animation cycling (using shared utility)
      if (e.key === 'm' || e.key === 'M') {
        const name = cycleAnimation(animStateRef.current, true)
        setAnimationName(name)
        if (name) setTimeout(() => setAnimationName(null), 2000)
      }

      // WASD/Arrow movement
      if (SHIP_KEYS.left.includes(e.key)) keys.left = true
      if (SHIP_KEYS.right.includes(e.key)) keys.right = true
      if (SHIP_KEYS.up.includes(e.key)) keys.up = true
      if (SHIP_KEYS.down.includes(e.key)) keys.down = true
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (SHIP_KEYS.left.includes(e.key)) keys.left = false
      if (SHIP_KEYS.right.includes(e.key)) keys.right = false
      if (SHIP_KEYS.up.includes(e.key)) keys.up = false
      if (SHIP_KEYS.down.includes(e.key)) keys.down = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [currentShip, onSelect])

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

    const config = SHIPS?.[currentIndex]
    if (!config) return
    loadShipModel(config, ship, true, result => {
      animState.animations = result.animations
      animState.mixer = result.mixer
    })

    // Update light intensities for new ship
    if (shipLight) {
      shipLight.intensity = config.shipLightIntensity ?? 2.0
    }
    if (overheadLightRef.current) {
      overheadLightRef.current.intensity = config.overheadLightIntensity ?? 0.8
    }
  }, [currentIndex])

  const handleSetup = useCallback(({ scene }: { scene: THREE.Scene }) => {
    // Create ship group
    const shipGroup = new THREE.Group()
    scene.add(shipGroup)
    shipGroupRef.current = shipGroup

    const firstShip = SHIPS?.[0]
    if (!firstShip) return

    // Add ship glow light (using shared utility)
    const shipLight = createShipLight(firstShip, scene)
    shipLightRef.current = shipLight

    // Add overhead directional light (same as Game.tsx)
    const overheadIntensity = firstShip.overheadLightIntensity ?? 0.8
    const overheadLight = new THREE.DirectionalLight(0xffffff, overheadIntensity)
    overheadLight.position.set(0, 10, 10)
    overheadLight.target = shipGroup
    scene.add(overheadLight)
    overheadLightRef.current = overheadLight

    // Add fallback geometry while loading (using shared utility)
    shipGroup.add(createFallbackCone(true))

    // Load initial ship
    loadShipModel(firstShip, shipGroup, true, result => {
      const animState = animStateRef.current
      animState.animations = result.animations
      animState.mixer = result.mixer
    })
  }, [])

  const handleAnimate = useCallback((_context: any, delta: number, time: number) => {
    const ship = shipGroupRef.current
    const shipLight = shipLightRef.current
    if (!ship) return

    // Slow rotation (10 seconds per revolution)
    const rotY = (time * (Math.PI * 2)) / 10
    ship.rotation.y = rotY

    // Update movement physics (using shared utilities)
    updateMovement(keysRef.current, velocityRef.current, delta)
    applyMovement(ship, velocityRef.current, delta, rotY)

    // Update ship light position
    if (shipLight) shipLight.position.copy(ship.position)

    // Update animation mixer
    if (animStateRef.current.mixer) {
      animStateRef.current.mixer.update(delta)
    }
  }, [])

  // Safety checks - must be AFTER all hooks (Rules of Hooks)
  if (!SHIPS || SHIPS.length === 0) {
    return <div className="picker-error">Loading ships...</div>
  }
  if (!currentShip) {
    return <div className="picker-error">Invalid ship index: {currentIndex}</div>
  }

  return (
    <Lightbox onSetup={handleSetup} onAnimate={handleAnimate}>
      <div className="picker-header">
        <h1 className="picker-title">SELECT SHIP</h1>
      </div>

      <div className="picker-info">
        <div className="picker-ship-name">{currentShip.name}</div>
        {currentShip.credit && (
          <div className="picker-credit">
            <a href={currentShip.creditUrl} target="_blank" rel="noreferrer noopener">
              {currentShip.credit}
            </a>
            {' by '}
            <a href={currentShip.authorUrl} target="_blank" rel="noreferrer noopener">
              {currentShip.author}
            </a>
            {' ('}
            {currentShip.license}
            {')'}
          </div>
        )}
        {animationName && <div className="picker-animation-name">{animationName}</div>}
      </div>

      <div className="picker-footer">
        <div className="picker-dots">
          {SHIPS.map((ship, i) => (
            <span key={ship.id} className={`picker-dot ${i === currentIndex ? 'active' : ''}`} />
          ))}
        </div>
        <div className="picker-controls">[/] or 1-8 ships • M anims • WASD fly • ENTER select</div>
      </div>

      <button
        type="button"
        className="picker-select-btn"
        onClick={() => onSelect(currentShip, animStateRef.current.currentIndex)}>
        SELECT
      </button>
    </Lightbox>
  )
}
