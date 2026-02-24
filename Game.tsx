import * as three from './three'
import { useEffect, useRef } from 'react'
import { createGround, createHorizon, createStars, applySceneConfig, SCENE_CONFIG } from './Scene'
import { createSun } from './Sun'
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
  getLevel1Progress,
  createObstacle,
  type ObstacleState,
} from './Obstacles'

// Standalone preview - auto-playing js demo using shared components
export default function Game() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup - same as initializeGame
    const scene = new three.Scene()
    const camera = new three.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150)
    camera.position.set(0, 1, 5)
    camera.lookAt(0, 0, -10)

    const renderer = new three.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    applySceneConfig(scene, renderer)
    containerRef.current.appendChild(renderer.domElement)

    // Post-processing bloom (controlled by SCENE_CONFIG)
    const composer = new three.EffectComposer(renderer)
    composer.addPass(new three.RenderPass(scene, camera))
    if (SCENE_CONFIG.bloomEnabled) {
      composer.addPass(
        new three.UnrealBloomPass(
          new three.Vector2(window.innerWidth, window.innerHeight),
          SCENE_CONFIG.bloomStrength,
          SCENE_CONFIG.bloomRadius,
          SCENE_CONFIG.bloomThreshold,
        ),
      )
    }

    // Create scene elements using shared functions
    const ground = createGround(scene)
    const sun = createSun(scene)
    createHorizon(scene)
    const stars = createStars(scene)
    const { ship, shipLight } = createShip(scene)

    // Auto-pilot game state
    const cubes: three.Object3D[] = []
    let velocity = 0
    let speed = 0.5
    let gridOffset = 0
    let nextSpawn = 0
    let _score = 0

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      composer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // Update auto-pilot cubes (movement, scoring, cleanup)
    const updateDemoCubes = (delta: number, currentSpeed: number) => {
      for (let i = cubes.length - 1; i >= 0; i--) {
        const cube = cubes[i]
        cube.position.z += delta * currentSpeed * 15
        cube.rotation.x += delta
        cube.rotation.y += delta * 0.5

        if (!cube.userData.passed && cube.position.z > 4) {
          cube.userData.passed = true
          _score += 10
        }
        if (cube.position.z > 10) {
          scene.remove(cube)
          cubes.splice(i, 1)
        }
      }
    }

    // Animation loop
    const timer = new three.Timer()
    let animationId: number

    function animate() {
      timer.update()
      const delta = timer.getDelta()
      const time = timer.getElapsed()

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

      updateDemoCubes(delta, speed)

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
        Auto-pilot demo
      </p>
    </div>
  )
}

interface GameCallbacks {
  onScore?: (score: number) => void
  onGameOver?: () => void
  onVictory?: (score: number) => void
  onPause?: (paused: boolean) => void
  onShipChange?: (ship: ShipConfig) => void
  onLevelClear?: () => void
  onLevelClearDone?: () => void
}

// Export as arrow function assigned to const - HMR should not wrap this as a component
export const initializeGame = (
  container: HTMLElement,
  callbacks: GameCallbacks,
  shipConfig?: ShipConfig,
  animationIndex = -1,
) => {
  // Scene setup
  const scene = new three.Scene()
  const camera = new three.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150)
  camera.position.set(0, 1, 5)
  camera.lookAt(0, 0, -10)

  const renderer = new three.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  applySceneConfig(scene, renderer)
  renderer.domElement.tabIndex = 0
  renderer.domElement.style.outline = 'none'
  container.appendChild(renderer.domElement)

  // Post-processing bloom (controlled by SCENE_CONFIG)
  const composer = new three.EffectComposer(renderer)
  composer.addPass(new three.RenderPass(scene, camera))
  if (SCENE_CONFIG.bloomEnabled) {
    composer.addPass(
      new three.UnrealBloomPass(
        new three.Vector2(window.innerWidth, window.innerHeight),
        SCENE_CONFIG.bloomStrength,
        SCENE_CONFIG.bloomRadius,
        SCENE_CONFIG.bloomThreshold,
      ),
    )
  }

  // Create scene elements
  const ground = createGround(scene)
  const sun = createSun(scene)
  const horizon = createHorizon(scene)
  const stars = createStars(scene)
  let currentLevel = 1
  const {
    ship,
    shipLight,
    config: initialShipConfig,
  } = createShip(scene, shipConfig, animationIndex, result => {
    animations = result.animations
    currentMixer = result.mixer
    currentAction = result.action
  })

  // Add directional light from above/behind to brighten the ship
  const overheadIntensity = initialShipConfig.overheadLightIntensity ?? 0.8
  const overheadLight = new three.DirectionalLight(0xffffff, overheadIntensity)
  overheadLight.position.set(0, 10, 10) // Above and behind
  overheadLight.target = ship // Always point at ship
  scene.add(overheadLight)

  // Game state
  const cubes: three.Mesh[] = []
  let velocity = 0
  let speed = 0
  let gridOffset = 0
  let scoreValue = 0
  let isGameOver = false
  let isStarted = false
  let isVictory = false
  let isPaused = false
  let victoryStartTime = 0
  const VICTORY_DURATION = 5 // seconds for victory animation
  // Level celebration spin
  let isSpinning = false
  let spinStartTime = 0
  let spinAxis: 'x' | 'y' = 'y'
  let spinDirection = 1 // 1 or -1
  let spinStartRotation = { x: 0, y: 0, z: 0 }
  const SPIN_DURATION = 2 // seconds for celebration spin
  const keys = { left: false, right: false, up: false, down: false }
  let obstacleState: ObstacleState | null = null

  const GROUND_Y = 0.3 // Ship resting Y position

  // Major level state
  let majorLevel = 2 // TODO: change back to 1 after playtesting
  let isLevelClear = false
  let levelClearStartTime = 0
  const LEVEL_CLEAR_DURATION = 3

  // Level 1: camera altitude control (0 = over-the-shoulder, 1 = bird's-eye)
  let cameraAltitude = 1.0
  let cameraAltVelocity = 0
  const CAM_ALT_ACCEL = 2.0
  const CAM_ALT_FRICTION = 0.90

  // Level 2: ship vertical flight
  let verticalVelocity = 0
  const VERT_ACCEL = 35
  const VERT_FRICTION = 0.92
  const LEVEL2_BASE_Y = 3.0

  // Ship/animation state for in-game switching
  let currentShipIndex = shipConfig ? SHIPS.findIndex(s => s.id === shipConfig.id) : 0
  if (currentShipIndex < 0) currentShipIndex = 0
  let currentAnimIndex = animationIndex
  let animations: three.AnimationClip[] = []
  let currentMixer: three.AnimationMixer | null = null
  let currentAction: three.AnimationAction | null = null

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
    loadShipModel(config, ship, false, result => {
      animations = result.animations
      currentMixer = result.mixer
    })
    callbacks.onShipChange?.(SHIPS[currentShipIndex])
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

  // Apply directional key state from event
  const applyDirectionKeys = (e: KeyboardEvent, state: boolean) => {
    if (SHIP_KEYS.left.includes(e.key)) keys.left = state
    if (SHIP_KEYS.right.includes(e.key)) keys.right = state
    if (SHIP_KEYS.up.includes(e.key)) keys.up = state
    if (SHIP_KEYS.down.includes(e.key)) keys.down = state
  }

  // Handle ship selection keys (number keys, brackets, animation)
  const handleShipKeys = (e: KeyboardEvent) => {
    const num = Number.parseInt(e.key, 10)
    if (num >= 1 && num <= Math.min(8, SHIPS.length)) {
      changeShip(num - 1)
      return
    }
    if (e.key === '[') changeShip((currentShipIndex - 1 + SHIPS.length) % SHIPS.length)
    else if (e.key === ']') changeShip((currentShipIndex + 1) % SHIPS.length)
    else if (e.key === 'm' || e.key === 'M') cycleAnimation()
  }

  // Keyboard controls using shared key mappings
  const onKeyDown = (e: KeyboardEvent) => {
    // P to pause/unpause during gameplay
    if ((e.key === 'p' || e.key === 'P') && isStarted && !isGameOver && !isVictory) {
      isPaused = !isPaused
      callbacks.onPause?.(isPaused)
      return
    }

    applyDirectionKeys(e, true)
    handleShipKeys(e)
  }
  const onKeyUp = (e: KeyboardEvent) => {
    applyDirectionKeys(e, false)
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

  // Celebration spin animation update
  const updateCelebrationSpin = (time: number) => {
    const spinProgress = (time - spinStartTime) / SPIN_DURATION
    if (spinProgress >= 1) {
      isSpinning = false
      ship.rotation.x = 0
      ship.rotation.y = spinStartRotation.y
      ship.rotation.z = 0
      return
    }
    // Smooth easing (ease-in-out)
    const eased =
      spinProgress < 0.5
        ? 2 * spinProgress * spinProgress
        : 1 - (-2 * spinProgress + 2) ** 2 / 2
    const spinAngle = eased * Math.PI * 2 * spinDirection
    if (spinAxis === 'x') {
      ship.rotation.x = spinStartRotation.x + spinAngle
    } else {
      ship.rotation.y = spinStartRotation.y + spinAngle
    }
  }

  // Handle level change (level clear, victory, or celebration)
  const handleLevelChange = (time: number) => {
    if (majorLevel === 1 && currentLevel > 6) {
      // Level 1 complete → show interstitial
      isLevelClear = true
      levelClearStartTime = time
      clearObstacles(scene, cubes)
      velocity = 0
      callbacks.onLevelClear?.()
    } else if (majorLevel === 2 && obstacleState && obstacleState.majorLevel === 3) {
      // Level 2 complete → actual victory
      isVictory = true
      victoryStartTime = time
      clearObstacles(scene, cubes)
      velocity = 0
    } else {
      // Sub-level celebration spin
      const levelColor = getLevelColor(currentLevel)
      ground.setColor(levelColor)
      horizon.setColor(levelColor)
      shipLight.color.setHex(levelColor)
      isSpinning = true
      spinStartTime = time
      const axes: Array<'x' | 'y'> = ['x', 'y']
      spinAxis = axes[Math.floor(Math.random() * 2)]
      spinDirection = Math.random() < 0.5 ? 1 : -1
      spinStartRotation = { x: ship.rotation.x, y: ship.rotation.y, z: ship.rotation.z }
    }
  }

  // Update Level 1 Clear interstitial (3-second auto-dismiss)
  const updateLevelClear = (delta: number, time: number) => {
    const progress = (time - levelClearStartTime) / LEVEL_CLEAR_DURATION

    // Celebration spin during interstitial
    ship.rotation.y += delta * Math.PI * 2
    // Slow ground scroll
    gridOffset += delta * 0.3 * 3
    ground.offset.y = gridOffset

    if (progress >= 1) {
      // Transition to Level 2
      isLevelClear = false
      majorLevel = 2
      const startTime = timer.getElapsed()
      obstacleState = createObstacleState(startTime)
      obstacleState.majorLevel = 2
      speed = 2.0
      currentLevel = 7 // Beyond L1 sub-levels
      ship.position.y = LEVEL2_BASE_Y
      ship.rotation.x = 0
      ship.rotation.z = 0
      cameraAltitude = 0
      cameraAltVelocity = 0
      verticalVelocity = 0
      // Update colors for Level 2
      const levelColor = getLevelColor(6) // White
      ground.setColor(levelColor)
      horizon.setColor(levelColor)
      shipLight.color.setHex(levelColor)
      callbacks.onLevelClearDone?.()
    }
  }

  // Level 1: camera altitude control (ship at ground, up/down moves camera)
  const updateLevel1Camera = (delta: number) => {
    ship.position.y = GROUND_Y

    if (keys.up && !keys.down) cameraAltVelocity += CAM_ALT_ACCEL * delta
    else if (keys.down && !keys.up) cameraAltVelocity -= CAM_ALT_ACCEL * delta
    else cameraAltVelocity *= CAM_ALT_FRICTION

    cameraAltitude += cameraAltVelocity * delta
    const maxAltitude = obstacleState ? 1.0 - getLevel1Progress(obstacleState) : 1.0
    cameraAltitude = Math.max(0, Math.min(maxAltitude, cameraAltitude))

    // Interpolate camera between over-the-shoulder (alt=0) and bird's-eye (alt=1)
    const camY = 1.2 + cameraAltitude * (4.5 - 1.2)
    const camZ = 3.5 + cameraAltitude * (8.0 - 3.5)
    const lookY = cameraAltitude * 0.5
    const lookZ = -10 - cameraAltitude * 5

    camera.position.x = ship.position.x * 0.9
    camera.position.y += (camY - camera.position.y) * 5 * delta
    camera.position.z = camZ
    camera.lookAt(ship.position.x * 0.9, lookY, lookZ)
  }

  // Level 2: free-fly (up/down moves ship vertically, camera follows)
  const updateLevel2Flight = (delta: number) => {
    if (keys.up && !keys.down) verticalVelocity += VERT_ACCEL * delta
    else if (keys.down && !keys.up) verticalVelocity -= VERT_ACCEL * delta
    else verticalVelocity *= VERT_FRICTION

    verticalVelocity = Math.max(-8, Math.min(8, verticalVelocity))
    ship.position.y += verticalVelocity * delta
    ship.position.y = Math.max(0.5, Math.min(6.0, ship.position.y))
    ship.rotation.x = -verticalVelocity * 0.02

    const targetCamY = ship.position.y + 0.9
    camera.position.x = ship.position.x * 0.9
    camera.position.y += (targetCamY - camera.position.y) * 15 * delta
    camera.position.z = 3.5
    camera.lookAt(ship.position.x * 0.9, ship.position.y, -10)
  }

  // Spawn obstacles and check level transitions
  const updateObstacleSpawning = (time: number, delta: number) => {
    if (!obstacleState) return

    const result = spawnObstacles(scene, obstacleState, delta, speed)
    cubes.push(...result.obstacles)
    obstacleState = result.newState
    speed = result.newSpeed

    if (majorLevel === 1 && obstacleState.level !== currentLevel) {
      currentLevel = obstacleState.level
      handleLevelChange(time)
    } else if (majorLevel === 2 && obstacleState.majorLevel === 3) {
      handleLevelChange(time)
    }
  }

  // Update gameplay state (movement, obstacles, collisions)
  const updateGameplay = (delta: number, time: number) => {
    gridOffset += delta * speed * 3
    ground.offset.y = gridOffset

    // Ship horizontal movement (same for both levels)
    const accel = delta * 35
    if (keys.left && !keys.right) velocity = Math.max(-8, velocity - accel)
    else if (keys.right && !keys.left) velocity = Math.min(8, velocity + accel)
    else velocity *= 0.92

    ship.position.x += velocity * delta
    ship.position.x = Math.max(-8, Math.min(8, ship.position.x))
    ship.rotation.z = -velocity * 0.08

    if (majorLevel === 1) updateLevel1Camera(delta)
    else updateLevel2Flight(delta)

    if (isSpinning) updateCelebrationSpin(time)

    shipLight.position.copy(ship.position)
    if (currentMixer) currentMixer.update(delta)

    updateObstacleSpawning(time, delta)

    // Check collisions
    const collision = updateObstacles(scene, cubes, ship.position.x, ship.position.y, delta, speed, scoreDelta => {
      scoreValue += scoreDelta
      callbacks.onScore?.(scoreValue)
    })
    if (collision) {
      isGameOver = true
      callbacks.onGameOver?.()
    }
  }

  // Victory animation - ship spins and flies into space
  const updateVictoryAnimation = (delta: number, time: number) => {
    const victoryProgress = (time - victoryStartTime) / VICTORY_DURATION
    if (victoryProgress >= 1) {
      callbacks.onVictory?.(scoreValue)
      return
    }
    ship.rotation.y += delta * Math.PI * (2 + victoryProgress * 4)
    ship.position.y += delta * (2 + victoryProgress * 15)
    ship.position.z -= delta * (5 + victoryProgress * 20)
    ship.rotation.x = -victoryProgress * 0.5

    camera.position.y = 1 + ship.position.y * 0.5
    camera.position.z = ship.position.z + 8
    camera.lookAt(ship.position)

    shipLight.color.setRGB(1, 1, 1)
    shipLight.intensity = 3 + victoryProgress * 5
    shipLight.position.copy(ship.position)
  }

  // Animation loop
  const timer = new three.Timer()
  let animationId: number

  function animate() {
    timer.update()
    const delta = timer.getDelta()
    const time = timer.getElapsed()

    stars.rotation.y += delta * 0.01
    sun.update(time)
    sun.mesh.scale.setScalar(1 + Math.sin(time * 2) * 0.05)

    if (isLevelClear) updateLevelClear(delta, time)
    else if (isStarted && !isGameOver && !isPaused) updateGameplay(delta, time)
    if (isVictory) updateVictoryAnimation(delta, time)

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
      isLevelClear = false
      scoreValue = 0
      velocity = 0
      verticalVelocity = 0
      cameraAltitude = 1.0
      cameraAltVelocity = 0
      ship.position.x = 0
      ship.rotation.x = 0
      ship.rotation.z = 0
      // Don't touch rotation.y - it's set by loadShipModel based on ship config
      shipLight.position.copy(ship.position)
      camera.position.x = 0

      // TODO: change back to 1 after playtesting
      majorLevel = 2
      if (majorLevel === 2) {
        // Start directly in Level 2 for playtesting
        ship.position.y = LEVEL2_BASE_Y
        camera.position.y = 1.2 + (LEVEL2_BASE_Y - GROUND_Y) * 0.5
        const startTime = timer.getElapsed()
        obstacleState = createObstacleState(startTime)
        obstacleState.majorLevel = 2
        speed = 2.0
        currentLevel = 7
        const levelColor = getLevelColor(6)
        ground.setColor(levelColor)
        horizon.setColor(levelColor)
        shipLight.color.setHex(levelColor)
      } else {
        ship.position.y = GROUND_Y
        camera.position.y = 1.5
        const startTime = timer.getElapsed()
        obstacleState = createObstacleState(startTime)
        speed = getLevelSpeed(1)
        currentLevel = 1
        const levelColor = getLevelColor(1)
        ground.setColor(levelColor)
        horizon.setColor(levelColor)
        shipLight.color.setHex(levelColor)
      }
    },
    cleanup: () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
    },
  }
}
