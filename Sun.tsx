/**
 * Sun.tsx - Animated sun with shader-based solar flares
 */
import * as THREE from 'three'
import { useEffect, useRef } from 'react'

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

// Standalone preview - isolated sun for testing the shader
export default function Sun() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Simple scene - just the sun on black
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200)
    camera.position.set(0, 0, 30)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    container.appendChild(renderer.domElement)

    // Create sun at origin for clear view
    const sun = createSun(scene)
    sun.mesh.position.set(0, 0, 0)

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
      const time = clock.getElapsedTime()
      sun.update(time)
      renderer.render(scene, camera)
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

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: '#000' }} />
}
