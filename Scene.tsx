import * as three from './three'
import { useEffect, useRef } from 'react'
import { createSun } from './Sun'

// ============================================================================
// CENTRALIZED SCENE CONFIG
// ============================================================================

export const SCENE_CONFIG = {
  clearColor: 0x050509, // Near-black background
  fogEnabled: false, // Set to true to enable fog
  fogColor: 0x0d0517, // Dark purple fog
  fogNear: 170,
  fogFar: 180,
  // Bloom post-processing
  bloomEnabled: true, // Set to true to enable bloom glow effect
  bloomStrength: 0.75,
  bloomRadius: 0.4,
  bloomThreshold: 0.1,
}

// Apply scene config to a js scene and renderer
export function applySceneConfig(scene: three.Scene, renderer: three.WebGLRenderer) {
  renderer.setClearColor(SCENE_CONFIG.clearColor)
  if (SCENE_CONFIG.fogEnabled) {
    scene.fog = new three.Fog(SCENE_CONFIG.fogColor, SCENE_CONFIG.fogNear, SCENE_CONFIG.fogFar)
  }
}

// ============================================================================

// Standalone preview - animated synthwave scene using shared js components
export default function Scene() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Scene setup
    const scene = new three.Scene()
    const camera = new three.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150)
    camera.position.set(0, 2, 5)
    camera.lookAt(0, 0, -10)

    const renderer = new three.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    applySceneConfig(scene, renderer)
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

    // Create scene elements using shared functions
    const gridTexture = createGround(scene)
    const sun = createSun(scene)
    createHorizon(scene)
    const stars = createStars(scene)

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // Animation loop
    const timer = new three.Timer()
    let animationId: number

    function animate() {
      timer.update()
      const delta = timer.getDelta()
      const time = timer.getElapsed()

      // Scroll ground
      gridTexture.offset.y += delta * 0.5

      // Animate sun flares and pulse
      sun.update(time)
      sun.mesh.scale.setScalar(1 + Math.sin(time * 2) * 0.05)

      // Rotate stars slowly
      stars.rotation.y += delta * 0.01

      composer.render()
      animationId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0 }} />
}

// Create the neon grid ground texture with configurable color
function createGridTexture(color = '#ff00ff') {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#050509'
  ctx.fillRect(0, 0, 512, 512)
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  for (let i = 0; i <= 16; i++) {
    ctx.globalAlpha = i % 4 === 0 ? 1 : 0.3
    ctx.beginPath()
    ctx.moveTo(0, i * 32)
    ctx.lineTo(512, i * 32)
    ctx.moveTo(i * 32, 0)
    ctx.lineTo(i * 32, 512)
    ctx.stroke()
  }
  const texture = new three.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = three.RepeatWrapping
  texture.repeat.set(30, 30)
  return texture
}

// Convert hex number to CSS color string
function hexToColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`
}

// Create scrolling ground plane - returns object with texture and setColor function
export function createGround(scene: three.Scene) {
  const material = new three.MeshBasicMaterial({ map: createGridTexture() })
  const ground = new three.Mesh(new three.PlaneGeometry(100, 100), material)
  ground.rotation.x = -Math.PI / 2
  // @ts-ignore - renderOrder exists on Object3D
  ground.renderOrder = 1 // Render after sun so it occludes it
  scene.add(ground)

  // Return texture for scrolling and setColor for level changes
  return {
    get offset() {
      return material.map!.offset
    },
    setColor(hexColor: number) {
      const colorStr = hexToColor(hexColor)
      material.map = createGridTexture(colorStr)
      material.needsUpdate = true
    },
  }
}

// Create horizon line - returns object with setColor function
export function createHorizon(scene: three.Scene) {
  const material = new three.MeshBasicMaterial({ color: 0x00ffff })
  const horizon = new three.Mesh(new three.PlaneGeometry(200, 0.5), material)
  horizon.rotation.x = -Math.PI / 2
  horizon.position.set(0, 0.01, -40)
  scene.add(horizon)

  return {
    setColor(hexColor: number) {
      material.color.setHex(hexColor)
    },
  }
}

// Create starfield (reduced count for less visual noise)
export function createStars(scene: three.Scene) {
  const starsGeom = new three.BufferGeometry()
  const starData = []
  for (let i = 0; i < 2000; i++) {
    starData.push((Math.random() - 0.5) * 200)
    starData.push(Math.random() * 40 + 5)
    starData.push((Math.random() - 0.5) * 200 - 20)
  }
  starsGeom.setAttribute('position', new three.Float32BufferAttribute(starData, 3))
  const stars = new three.Points(
    starsGeom,
    new three.PointsMaterial({ size: 0.15, color: 0xffffff }),
  )
  scene.add(stars)
  return stars
}
