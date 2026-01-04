import * as THREE from 'three'
import { useEffect, useRef } from 'react'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createGround, createSun, createHorizon, createStars, applySceneConfig, SCENE_CONFIG } from './Scene'
import { createShip } from './Ship'
import { SHIP_KEYS } from './Keyboard'
import { SHIPS, loadShipModel, type ShipConfig } from './Ships'
import {
  createObstacleState,
  spawnObstacles,
  updateObstacles,
  clearObstacles,
  getLevelColor,
  getLevelSpeed,
  createObstacle,
  type ObstacleState,
} from './Obstacles'

// Standalone preview - auto-playing THREE.js demo using shared components
export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup - same as initializeGame
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150)
    camera.position.set(0, 1, 5)
    camera.lookAt(0, 0, -10)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    applySceneConfig(scene, renderer)
    containerRef.current.appendChild(renderer.domElement)

    // Post-processing bloom (controlled by SCENE_CONFIG)
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    if (SCENE_CONFIG.bloomEnabled) {
      composer.addPass(new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        SCENE_CONFIG.bloomStrength, SCENE_CONFIG.bloomRadius, SCENE_CONFIG.bloomThreshold
      ))
    }

    // Create scene elements using shared functions
    const ground = createGround(scene)
    const sun = createSun(scene)
    createHorizon(scene)
    const stars = createStars(scene)
    const { ship, shipLight } = createShip(scene)

    // Auto-pilot game state
    const cubes: THREE.Object3D[] = []
    let velocity = 0, speed = 0.5, gridOffset = 0, nextSpawn = 0
    let score = 0

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      composer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // Animation loop
    const clock = new THREE.Clock()
    let animationId: number

    function animate() {
      const delta = clock.getDelta()
      const time = clock.getElapsedTime()

      // Animate scene elements
      stars.rotation.y += delta * 0.01
      sun.update(time)
      sun.mesh.scale.setScalar(1 + Math.sin(time * 2) * 0.05)

      // Scroll ground
      gridOffset += delta * speed * 3
      ground.offset.y = gridOffset

      // Auto-pilot: find nearest obstacle and dodge
      let targetX = 0
      const nearestCube = cubes.find(c => c.position.z > -10 && c.position.z < 0)
      if (nearestCube) {
        targetX = nearestCube.position.x > 0 ? -3 : 3
      }

      // Smoothly move toward target
      const diff = targetX - ship.position.x
      velocity += diff * delta * 5
      velocity *= 0.95
      velocity = Math.max(-8, Math.min(8, velocity))

      ship.position.x += velocity * delta
      ship.position.x = Math.max(-8, Math.min(8, ship.position.x))
      ship.rotation.z = -velocity * 0.08
      shipLight.position.copy(ship.position)
      camera.position.x = ship.position.x * 0.5

      // Spawn cubes (simple random for auto-pilot demo)
      if (time > nextSpawn) {
        const x = (Math.random() - 0.5) * 14
        cubes.push(createObstacle(scene, x, 0xff0066))
        nextSpawn = time + 0.4 + Math.random() * 0.4
        speed = Math.min(3, speed + 0.01)
      }

      // Update cubes
      for (let i = cubes.length - 1; i >= 0; i--) {
        const cube = cubes[i]
        cube.position.z += delta * speed * 15
        cube.rotation.x += delta
        cube.rotation.y += delta * 0.5

        if (!cube.userData.passed && cube.position.z > 4) {
          cube.userData.passed = true
          score += 10
        }

        if (cube.position.z > 10) {
          scene.remove(cube)
          cubes.splice(i, 1)
        }
      }

      composer.render()
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
        Auto-pilot demo
      </p>
    </div>
  )
}

interface GameCallbacks {
  onScore?: (score: number) => void;
  onGameOver?: () => void;
  onVictory?: (score: number) => void;
  onPause?: (paused: boolean) => void;
}

// Export as arrow function assigned to const - HMR should not wrap this as a component
export const initializeGame = (container: HTMLElement, callbacks: GameCallbacks, shipConfig?: ShipConfig, animationIndex = -1) => {
  // Scene setup
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150)
  camera.position.set(0, 1, 5)
  camera.lookAt(0, 0, -10)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  applySceneConfig(scene, renderer)
  renderer.domElement.tabIndex = 0
  renderer.domElement.style.outline = 'none'
  container.appendChild(renderer.domElement)

  // Post-processing bloom (controlled by SCENE_CONFIG)
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  if (SCENE_CONFIG.bloomEnabled) {
    composer.addPass(new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      SCENE_CONFIG.bloomStrength, SCENE_CONFIG.bloomRadius, SCENE_CONFIG.bloomThreshold
    ))
  }

  // Create scene elements
  const ground = createGround(scene)
  const sun = createSun(scene)
  const horizon = createHorizon(scene)
  const stars = createStars(scene)
  let currentLevel = 1
  const { ship, shipLight, config: initialShipConfig } = createShip(scene, shipConfig, animationIndex, (result) => {
    animations = result.animations
    currentMixer = result.mixer
    currentAction = result.action
  })

  // Add directional light from above/behind to brighten the ship
  const overheadIntensity = initialShipConfig.overheadLightIntensity ?? 0.8
  const overheadLight = new THREE.DirectionalLight(0xffffff, overheadIntensity)
  overheadLight.position.set(0, 10, 10)  // Above and behind
  overheadLight.target = ship  // Always point at ship
  scene.add(overheadLight)

  // Game state
  const cubes: THREE.Mesh[] = []
  let velocity = 0, speed = 0, gridOffset = 0
  let scoreValue = 0, isGameOver = false, isStarted = false, isVictory = false
  let isPaused = false
  let victoryStartTime = 0
  const VICTORY_DURATION = 5  // seconds for victory animation
  // Level celebration spin
  let isSpinning = false
  let spinStartTime = 0
  let spinAxis: 'x' | 'y' | 'z' = 'y'
  let spinStartRotation = { x: 0, y: 0, z: 0 }
  const SPIN_DURATION = 2  // seconds for celebration spin
  const keys = { left: false, right: false, up: false, down: false }
  let cameraY = 1.5  // Base camera height (slightly raised for better obstacle visibility)
  let obstacleState: ObstacleState | null = null

  // Ship/animation state for in-game switching
  let currentShipIndex = shipConfig ? SHIPS.findIndex(s => s.id === shipConfig.id) : 0
  if (currentShipIndex < 0) currentShipIndex = 0
  let currentAnimIndex = animationIndex
  let animations: THREE.AnimationClip[] = []
  let currentMixer: THREE.AnimationMixer | null = null
  let currentAction: THREE.AnimationAction | null = null

  // Helper to change ship during gameplay
  const changeShip = (index: number) => {
    currentShipIndex = index
    currentAnimIndex = -1
    currentAction = null
    currentMixer = null
    animations = []
    const config = SHIPS[index]
    // Update light intensities for new ship
    overheadLight.intensity = config.overheadLightIntensity ?? 0.8
    shipLight.intensity = config.shipLightIntensity ?? 2.0
    loadShipModel(config, ship, false, (result) => {
      animations = result.animations
      currentMixer = result.mixer
    })
  }

  // Helper to cycle animation during gameplay
  const cycleAnimation = () => {
    if (!currentMixer || animations.length === 0) return
    // Stop current animation
    if (currentAction) {
      currentAction.stop()
      currentAction = null
    }
    // Cycle to next animation (-1 = none, 0, 1, 2, ... , back to -1)
    currentAnimIndex = currentAnimIndex >= animations.length - 1 ? -1 : currentAnimIndex + 1
    if (currentAnimIndex >= 0) {
      currentAction = currentMixer.clipAction(animations[currentAnimIndex])
      currentAction.play()
    }
  }

  // Keyboard controls using shared key mappings
  const onKeyDown = (e: KeyboardEvent) => {
    // P to pause/unpause during gameplay
    if ((e.key === 'p' || e.key === 'P') && isStarted && !isGameOver && !isVictory) {
      isPaused = !isPaused
      callbacks.onPause?.(isPaused)
      return
    }

    if (SHIP_KEYS.left.includes(e.key)) keys.left = true
    if (SHIP_KEYS.right.includes(e.key)) keys.right = true
    if (SHIP_KEYS.up.includes(e.key)) keys.up = true
    if (SHIP_KEYS.down.includes(e.key)) keys.down = true

    // 1-8 for direct ship selection
    const num = parseInt(e.key)
    if (num >= 1 && num <= Math.min(8, SHIPS.length)) {
      changeShip(num - 1)
      return
    }

    // [/] to change ships, M to cycle animations
    if (e.key === '[') {
      changeShip((currentShipIndex - 1 + SHIPS.length) % SHIPS.length)
    } else if (e.key === ']') {
      changeShip((currentShipIndex + 1) % SHIPS.length)
    } else if (e.key === 'm' || e.key === 'M') {
      cycleAnimation()
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

  // Resize handler
  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    composer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', onResize)

  // Animation loop
  const clock = new THREE.Clock()
  let animationId: number

  function animate() {
    const delta = clock.getDelta()
    const time = clock.getElapsedTime()

    stars.rotation.y += delta * 0.01
    sun.update(time)
    sun.mesh.scale.setScalar(1 + Math.sin(time * 2) * 0.05)

    if (isStarted && !isGameOver && !isPaused) {
      // Scroll ground
      gridOffset += delta * speed * 3
      ground.offset.y = gridOffset

      // Ship movement - snappier acceleration and more dramatic tilt
      const accel = delta * 35
      if (keys.left && !keys.right) velocity = Math.max(-8, velocity - accel)
      else if (keys.right && !keys.left) velocity = Math.min(8, velocity + accel)
      else velocity *= 0.92

      ship.position.x += velocity * delta
      ship.position.x = Math.max(-8, Math.min(8, ship.position.x))
      ship.rotation.z = -velocity * 0.08

      // Celebration spin animation
      if (isSpinning) {
        const spinProgress = (time - spinStartTime) / SPIN_DURATION
        if (spinProgress >= 1) {
          isSpinning = false
          // Restore to pre-spin rotation (don't override ship's configured gameRotation)
          ship.rotation.x = 0
          ship.rotation.y = spinStartRotation.y
          ship.rotation.z = 0
        } else {
          // Smooth easing (ease-in-out)
          const eased = spinProgress < 0.5
            ? 2 * spinProgress * spinProgress
            : 1 - Math.pow(-2 * spinProgress + 2, 2) / 2
          const spinAngle = eased * Math.PI * 2  // Full 360° rotation
          // Apply spin on the chosen axis
          if (spinAxis === 'x') {
            ship.rotation.x = spinStartRotation.x + spinAngle
          } else if (spinAxis === 'y') {
            ship.rotation.y = spinStartRotation.y + spinAngle
          } else {
            ship.rotation.z = spinStartRotation.z + spinAngle
          }
        }
      }

      shipLight.position.copy(ship.position)
      camera.position.x = ship.position.x * 0.9

      // Camera vertical movement - move back and tilt down as camera rises
      if (keys.up) cameraY = Math.min(8, cameraY + delta * 3)
      if (keys.down) cameraY = Math.max(1, cameraY - delta * 3)
      camera.position.y = cameraY
      // Move camera back as it goes up (base z=5, max z=8 at max height)
      camera.position.z = 5 + (cameraY - 2) * 0.5
      // Look at a point ahead but low enough to keep ship visible
      camera.lookAt(ship.position.x * 0.9, 0, -10)

      // Update animation mixer
      if (currentMixer) currentMixer.update(delta)

      // Spawn obstacles using level system (distance-based)
      if (obstacleState) {
        const result = spawnObstacles(scene, obstacleState, delta, speed)
        cubes.push(...result.obstacles)
        obstacleState = result.newState
        speed = result.newSpeed

        // Update scene colors when level changes
        if (obstacleState.level !== currentLevel) {
          currentLevel = obstacleState.level

          // Victory! Completed all 6 levels (level 7+ means victory)
          if (currentLevel > 6) {
            isVictory = true
            victoryStartTime = time
            clearObstacles(scene, cubes)
            // Center ship for takeoff
            velocity = 0
          } else {
            const levelColor = getLevelColor(currentLevel)
            ground.setColor(levelColor)
            horizon.setColor(levelColor)
            shipLight.color.setHex(levelColor)
            // Start celebration spin
            isSpinning = true
            spinStartTime = time
            const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z']
            spinAxis = axes[Math.floor(Math.random() * 3)]
            spinStartRotation = { x: ship.rotation.x, y: ship.rotation.y, z: ship.rotation.z }
          }
        }
      }

      // Update obstacles and check for collisions
      const collision = updateObstacles(scene, cubes, ship.position.x, delta, speed, (scoreDelta) => {
        scoreValue += scoreDelta
        callbacks.onScore?.(scoreValue)
      })

      if (collision) {
        isGameOver = true
        callbacks.onGameOver?.()
      }
    }

    // Victory animation - ship spins and flies into space
    if (isVictory) {
      const victoryProgress = (time - victoryStartTime) / VICTORY_DURATION

      if (victoryProgress < 1) {
        // Spin faster over time (up to 3 revolutions per second)
        const spinSpeed = 2 + victoryProgress * 4
        ship.rotation.y += delta * Math.PI * spinSpeed

        // Fly upward with increasing speed
        const liftSpeed = 2 + victoryProgress * 15
        ship.position.y += delta * liftSpeed

        // Move forward (away from camera)
        ship.position.z -= delta * (5 + victoryProgress * 20)

        // Tilt up slightly as we take off
        ship.rotation.x = -victoryProgress * 0.5

        // Camera follows ship with smooth tracking
        camera.position.y = 1 + ship.position.y * 0.5
        camera.position.z = ship.position.z + 8
        camera.lookAt(ship.position)

        // Fade ship light to white as we ascend
        const r = 1, g = 1, b = 1
        shipLight.color.setRGB(r, g, b)
        shipLight.intensity = 3 + victoryProgress * 5
        shipLight.position.copy(ship.position)
      } else {
        // Victory complete - call callback
        callbacks.onVictory?.(scoreValue)
      }
    }

    composer.render()
    animationId = requestAnimationFrame(animate)
  }

  animate()

  return {
    start: () => {
      renderer.domElement.focus()
      clearObstacles(scene, cubes)
      isStarted = true
      isGameOver = false
      isPaused = false
      isVictory = false
      isSpinning = false
      scoreValue = 0
      velocity = 0
      ship.position.x = 0
      ship.rotation.x = 0
      ship.rotation.z = 0
      // Don't touch rotation.y - it's set by loadShipModel based on ship config
      shipLight.position.copy(ship.position)
      camera.position.x = 0
      cameraY = 1.5
      camera.position.y = cameraY
      // Initialize obstacle state with level 1
      const startTime = clock.getElapsedTime()
      obstacleState = createObstacleState(startTime)
      speed = getLevelSpeed(1)
      currentLevel = 1
      const levelColor = getLevelColor(1)
      ground.setColor(levelColor)
      horizon.setColor(levelColor)
      shipLight.color.setHex(levelColor)
    },
    cleanup: () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    }
  }
}
