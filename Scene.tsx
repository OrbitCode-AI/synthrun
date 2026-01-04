import * as THREE from 'three'
import { useEffect, useRef } from 'react'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

// ============================================================================
// CENTRALIZED SCENE CONFIG
// ============================================================================

export const SCENE_CONFIG = {
  clearColor: 0x050509,      // Near-black background
  fogEnabled: false,          // Set to true to enable fog
  fogColor: 0x0d0517,        // Dark purple fog
  fogNear: 170,
  fogFar: 180,
  // Bloom post-processing
  bloomEnabled: true,       // Set to true to enable bloom glow effect
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
      composer.addPass(new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        SCENE_CONFIG.bloomStrength, SCENE_CONFIG.bloomRadius, SCENE_CONFIG.bloomThreshold
      ))
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
  return '#' + hex.toString(16).padStart(6, '0')
}

// Create scrolling ground plane - returns object with texture and setColor function
export function createGround(scene: THREE.Scene) {
  const material = new THREE.MeshBasicMaterial({ map: createGridTexture(), transparent: true, opacity: 0.8 })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), material)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // Return texture for scrolling and setColor for level changes
  return {
    get offset() { return material.map!.offset },
    setColor(hexColor: number) {
      const colorStr = hexToColor(hexColor)
      material.map = createGridTexture(colorStr)
      material.needsUpdate = true
    }
  }
}

// Create sun with animated solar flares
export function createSun(scene: THREE.Scene) {
  // @ts-ignore - ShaderMaterial available at runtime
  const sunMaterial = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        v += noise(p * 4.0) * 0.5;
        v += noise(p * 8.0) * 0.25;
        v += noise(p * 16.0) * 0.125;
        v += noise(p * 32.0) * 0.0625;
        return v;
      }

      void main() {
        vec2 center = vUv - 0.5;
        float dist = length(center) * 2.0;
        float angle = atan(center.y, center.x);

        float diskRadius = 0.75;
        float normalizedDist = clamp(dist / diskRadius, 0.0, 1.0);

        // Dark burnt orange base
        vec3 darkSpot = vec3(0.18, 0.04, 0.002);
        vec3 lightSpot = vec3(0.45, 0.12, 0.008);

        // Deep granulation texture
        float tex = fbm(vUv * 40.0);
        tex = tex * tex;
        vec3 baseColor = mix(darkSpot, lightSpot, tex);

        // Limb brightening
        float limb = pow(normalizedDist, 3.0);
        baseColor = mix(baseColor, baseColor * 1.3, limb);

        // Thin bright rim
        float rim = smoothstep(0.96, 0.995, normalizedDist);
        baseColor = mix(baseColor, vec3(0.6, 0.28, 0.025), rim);

        // Hard disk cutoff
        float diskMask = 1.0 - step(diskRadius, dist);

        // === ANIMATED SOLAR FLARES ===
        float flareRegion = step(diskRadius * 0.92, dist) * (1.0 - step(diskRadius * 3.0, dist));

        float flares = 0.0;
        for (float i = 0.0; i < 4.0; i++) {
          float speed = 0.03 + i * 0.015;
          float scale = 6.0 + i * 3.0;
          float angleOffset = uTime * speed + i * 1.57;

          float rayNoise = noise(vec2(angle * scale + angleOffset, dist * 2.0 + uTime * 0.02));
          float ray = pow(rayNoise, 2.0);

          float distFromEdge = (dist - diskRadius) / diskRadius;
          float fadeFactor = exp(-distFromEdge * 1.8);

          flares += ray * fadeFactor * (0.5 - i * 0.08);
        }
        flares *= flareRegion;

        vec3 flareColor = vec3(0.7, 0.3, 0.06) * flares;

        // Tiny corona
        float corona = exp(-pow((dist - diskRadius) * 18.0, 2.0)) * 0.03;
        corona *= step(diskRadius, dist);

        float alpha = max(diskMask, max(corona, flares * 0.8));
        vec3 finalColor = baseColor * diskMask + vec3(0.3, 0.1, 0.01) * corona + flareColor;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  })

  const sun = new THREE.Mesh(new THREE.PlaneGeometry(25, 25), sunMaterial)
  sun.position.set(0, 6, -50)
  scene.add(sun)

  return {
    mesh: sun,
    material: sunMaterial,
    update(time: number) {
      sunMaterial.uniforms.uTime.value = time;
    }
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
    }
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
  const stars = new THREE.Points(starsGeom, new THREE.PointsMaterial({ size: 0.15, color: 0xffffff }))
  scene.add(stars)
  return stars
}
