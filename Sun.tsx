/**
 * Sun.tsx - Animated sun with shader-based solar flares
 */
import * as THREE from 'three';
import { useEffect, useRef } from 'react';

// Create sun with animated solar flares
export function createSun(scene: THREE.Scene) {
  // @ts-ignore - ShaderMaterial available at runtime
  const sunMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false, // Don't write to depth buffer (transparent)
    uniforms: {
      uTime: { value: 0.0 },
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

        // Smaller disk radius relative to plane (plane is now larger)
        float diskRadius = 0.38;
        float normalizedDist = clamp(dist / diskRadius, 0.0, 1.0);

        // Dark burnt orange base
        vec3 darkSpot = vec3(0.18, 0.04, 0.002);
        vec3 lightSpot = vec3(0.45, 0.12, 0.008);

        // Deep granulation texture
        float tex = fbm(vUv * 80.0);  // Higher frequency for smaller disk
        tex = tex * tex;
        vec3 baseColor = mix(darkSpot, lightSpot, tex);

        // Limb brightening - gradual increase toward edge
        float limb = pow(normalizedDist, 4.0);
        baseColor = mix(baseColor, baseColor * 1.4, limb);

        // Very thin bright rim - gradient falloff like reference
        // Peak brightness right at edge, falls off quickly inward
        float rimPeak = smoothstep(0.97, 0.995, normalizedDist);
        float rimGlow = smoothstep(0.85, 0.995, normalizedDist) * 0.3;
        vec3 rimColor = vec3(0.9, 0.5, 0.08);
        baseColor = mix(baseColor, baseColor + rimColor * rimGlow, 1.0);
        baseColor = mix(baseColor, rimColor, rimPeak * 0.7);

        // Hard disk cutoff
        float diskMask = 1.0 - step(diskRadius, dist);

        // === ANIMATED SOLAR FLARES ===
        // Start flares from just inside disk edge, extend far out
        float flareStart = diskRadius * 0.95;
        float flareEnd = 0.95;  // Near edge of UV space
        float flareRegion = smoothstep(flareStart, diskRadius, dist) * (1.0 - smoothstep(flareEnd * 0.8, flareEnd, dist));

        float flares = 0.0;
        for (float i = 0.0; i < 4.0; i++) {
          float speed = 0.03 + i * 0.015;
          float scale = 6.0 + i * 3.0;
          float angleOffset = uTime * speed + i * 1.57;

          float rayNoise = noise(vec2(angle * scale + angleOffset, dist * 2.0 + uTime * 0.02));
          float ray = pow(rayNoise, 2.0);

          float distFromEdge = (dist - diskRadius) / diskRadius;
          float fadeFactor = exp(-distFromEdge * 1.2);

          flares += ray * fadeFactor * (0.5 - i * 0.08);
        }
        flares *= flareRegion;

        // Edge fade - flares fade out toward plane edges
        float edgeFade = 1.0 - smoothstep(0.7, 0.98, dist);
        flares *= edgeFade;

        vec3 flareColor = vec3(0.6, 0.25, 0.05) * flares;

        // Soft corona glow
        float corona = exp(-pow((dist - diskRadius) * 12.0, 2.0)) * 0.04;
        corona *= step(diskRadius, dist);
        corona *= edgeFade;

        float alpha = max(diskMask, max(corona, flares * 0.6));
        vec3 finalColor = baseColor * diskMask + vec3(0.25, 0.1, 0.01) * corona + flareColor;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  });

  // Larger plane so flares don't get truncated
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), sunMaterial);
  sun.position.set(0, 6, -50);
  // @ts-ignore - renderOrder exists on Object3D
  sun.renderOrder = -1; // Render before ground so ground occludes it
  scene.add(sun);

  return {
    mesh: sun,
    material: sunMaterial,
    update(time: number) {
      sunMaterial.uniforms.uTime.value = time;
    },
  };
}

// Standalone preview - isolated sun for testing the shader
export default function Sun() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Simple scene - just the sun on black
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    camera.position.set(0, 0, 30);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Create sun at origin for clear view
    const sun = createSun(scene);
    sun.mesh.position.set(0, 0, 0);

    // Resize handler
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    // Animation loop
    const clock = new THREE.Clock();
    let animationId: number;

    function animate() {
      const time = clock.getElapsedTime();
      sun.update(time);
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} style={{ position: 'fixed', inset: 0, background: '#000' }} />;
}
