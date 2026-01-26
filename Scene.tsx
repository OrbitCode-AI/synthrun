import * as THREE from 'three'
import { useEffect, useRef } from 'react'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
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

// Apply scene config to a THREE.js scene and renderer
export function applySceneConfig(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  renderer.setClearColor(SCENE_CONFIG.clearColor)
  if (SCENE_CONFIG.fogEnabled) {
    scene.fog = new THREE.Fog(SCENE_CONFIG.fogColor, SCENE_CONFIG.fogNear, SCENE_CONFIG.fogFar)
  }
}

// ============================================================================

// Standalone preview - animated synthwave scene using shared THREE.js components
export default function Scene() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Scene setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 150)
    camera.position.set(0, 2, 5)
    camera.lookAt(0, 0, -10)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    applySceneConfig(scene, renderer)
    container.appendChild(renderer.domElement)

    // Post-processing bloom (controlled by SCENE_CONFIG)
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    if (SCENE_CONFIG.bloomEnabled) {
      composer.addPass(
        new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
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
    const clock = new THREE.Clock()
    let animationId: number

    function animate() {
      const delta = clock.getDelta()
      const time = clock.getElapsedTime()

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
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(30, 30)
  return texture
}

// Convert hex number to CSS color string
function hexToColor(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`
}

// Create scrolling ground plane - returns object with texture and setColor function
export function createGround(scene: THREE.Scene) {
  const material = new THREE.MeshBasicMaterial({ map: createGridTexture() })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material)
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
export function createHorizon(scene: THREE.Scene) {
  const material = new THREE.MeshBasicMaterial({ color: 0x00ffff })
  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(200, 0.5), material)
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
export function createStars(scene: THREE.Scene) {
  const starsGeom = new THREE.BufferGeometry()
  const starData = []
  for (let i = 0; i < 2000; i++) {
    starData.push((Math.random() - 0.5) * 200)
    starData.push(Math.random() * 40 + 5)
    starData.push((Math.random() - 0.5) * 200 - 20)
  }
  starsGeom.setAttribute('position', new THREE.Float32BufferAttribute(starData, 3))
  const stars = new THREE.Points(
    starsGeom,
    new THREE.PointsMaterial({ size: 0.15, color: 0xffffff }),
  )
  scene.add(stars)
  return stars
}
