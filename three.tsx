// Three.js barrel — centralizes all imports (core + addons) for synthrun
export * from 'three'
export { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
export { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
export { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
export { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
export { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

export default function Planet() {
  return <span style={{ fontSize: '50vmin' }}>🪐</span>
}
