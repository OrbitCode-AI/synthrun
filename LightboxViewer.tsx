/**
 * LightboxViewer - 3D object viewer with spinning colored lights
 * Renders a subject (e.g. ship model) with orbiting light orbs
 */
import * as THREE from 'three'
import { useEffect, useRef } from 'preact/hooks'
import { SCENE_CONFIG } from './Scene'

// Default light colors - synthwave palette
const DEFAULT_COLORS = [
  0xff0080, 0x00ffff, 0xffff00, 0x8000ff,  // pink, cyan, yellow, purple
  0xff4400, 0x00ff80, 0xff00ff, 0x80ff00,  // orange, mint, magenta, lime
  0x0080ff, 0xff8000, 0x00ff00, 0xff0040,  // blue, amber, green, red-pink
  0x40ffff, 0xffff80, 0xff80ff, 0x80ffff,  // light cyan, light yellow, light pink, aqua
]

export interface LightboxConfig {
  // Background
  backgroundColor?: number
  fogColor?: number
  fogNear?: number
  fogFar?: number

  // Camera
  cameraFov?: number
  cameraPosition?: [number, number, number]
  cameraLookAt?: [number, number, number]

  // Lights
  numLights?: number
  lightColors?: number[]
  lightIntensity?: number
  lightDistance?: number
  lightRadius?: number
  orbSize?: number

  // Ambient
  ambientColor?: number
  ambientIntensity?: number
}

const defaultConfig: Required<LightboxConfig> = {
  backgroundColor: 0x0a0015,
  fogColor: 0x0a0015,
  fogNear: 8,
  fogFar: 25,
  cameraFov: 50,
  cameraPosition: [0, 3, 5],
  cameraLookAt: [0, 0, 0],
  numLights: 12,
  lightColors: DEFAULT_COLORS,
  lightIntensity: 18,
  lightDistance: 20,
  lightRadius: 4,
  orbSize: 0.2,
  ambientColor: 0x404040,
  ambientIntensity: 0.3,
}

export interface LightboxViewerProps {
  config?: LightboxConfig
  onSetup?: (context: LightboxContext) => void
  onAnimate?: (context: LightboxContext, delta: number, time: number) => void
  children?: any
}

export interface LightboxContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  lights: THREE.PointLight[]
}

export default function LightboxViewer({ config = {}, onSetup, onAnimate, children }: LightboxViewerProps) {
  const containerRef = useRef(null)
  const cfg = { ...defaultConfig, ...config }

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(cfg.backgroundColor)
    if (SCENE_CONFIG.fogEnabled) {
      scene.fog = new THREE.Fog(cfg.fogColor, cfg.fogNear, cfg.fogFar)
    }

    const camera = new THREE.PerspectiveCamera(cfg.cameraFov, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(...cfg.cameraPosition)
    camera.lookAt(...cfg.cameraLookAt)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.domElement.tabIndex = 0
    renderer.domElement.style.outline = 'none'
    containerRef.current.appendChild(renderer.domElement)

    // Ambient light
    const ambientLight = new THREE.AmbientLight(cfg.ambientColor, cfg.ambientIntensity)
    scene.add(ambientLight)

    // Spinning colored lights with visible orbs
    const lights: THREE.PointLight[] = []
    for (let i = 0; i < cfg.numLights; i++) {
      const color = cfg.lightColors[i % cfg.lightColors.length]
      const light = new THREE.PointLight(color, cfg.lightIntensity, cfg.lightDistance)
      light.userData.angle = (i / cfg.numLights) * Math.PI * 2
      light.userData.radius = cfg.lightRadius
      light.userData.speed = 1.5 + (i % 3) * 0.3  // ~3-5 sec per revolution
      light.userData.yOffset = -0.5 + (i % 3) * 0.3
      scene.add(light)

      // Add visible glowing orb at light position
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(cfg.orbSize, 8, 8),
        new THREE.MeshBasicMaterial({ color })
      )
      light.add(orb)
      lights.push(light)
    }

    const context: LightboxContext = { scene, camera, renderer, lights }

    // Let parent set up their content
    onSetup?.(context)

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

    const animate = () => {
      const delta = clock.getDelta()
      const time = clock.getElapsedTime()

      // Update spinning lights
      for (const light of lights) {
        const angle = light.userData.angle + time * light.userData.speed
        light.position.x = Math.cos(angle) * light.userData.radius
        light.position.z = Math.sin(angle) * light.userData.radius
        light.position.y = light.userData.yOffset + Math.sin(time * 2 + light.userData.angle) * 0.5
      }

      // Let parent animate their content
      onAnimate?.(context, delta, time)

      renderer.render(scene, camera)
      animationId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (containerRef.current) {
        containerRef.current.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'fixed', inset: 0 }}>
      {children}
    </div>
  )
}
