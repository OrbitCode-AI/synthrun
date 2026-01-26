/**
 * Ship model configurations
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'

// Default export for preview
export default function ShipsConfig() {
  return (
    <div
      style={{
        background: '#0a0015',
        color: '#00ffff',
        fontFamily: 'monospace',
        padding: 40,
        minHeight: '100vh',
      }}>
      <h1 style={{ color: '#ff00ff' }}>Ships</h1>
      {SHIPS.map((s, i) => (
        <div key={s.id} style={{ marginBottom: 15, padding: 10, border: '1px solid #333' }}>
          <b style={{ color: '#ff00ff' }}>
            {i + 1}. {s.name}
          </b>{' '}
          - {s.credit} ({s.license})
        </div>
      ))}
    </div>
  )
}

// CDN base URL for 3D models (loaded at runtime, not bundled with project)
const MODELS_CDN = 'https://orbitcode.ai/models'

export interface ShipConfig {
  id: string
  name: string
  url: string
  scale: number
  previewScale: number // Larger scale for lightbox preview
  rotation: number // Y rotation for picker (facing camera)
  gameRotation: number // Y rotation for game (facing away from camera)
  yOffset?: number // Vertical offset for picker (negative = lower)
  gameYOffset?: number // Vertical offset for game
  hideMeshes?: string[] // Mesh names to hide (e.g. ground planes)
  overheadLightIntensity?: number // White light from above (default 0.8)
  shipLightIntensity?: number // Magenta glow light below ship (default 2.0)
  credit?: string
  creditUrl?: string // Link to model source
  author?: string
  authorUrl?: string // Link to author profile
  license?: string
}

export const SHIPS: ShipConfig[] = [
  {
    id: 'lowpoly',
    name: 'Low Poly',
    url: `${MODELS_CDN}/spaceship/scene.gltf`,
    scale: 0.03,
    previewScale: 0.06,
    rotation: Math.PI,
    gameRotation: 0,
    overheadLightIntensity: 2,
    credit: 'Low Poly Spaceship',
    creditUrl:
      'https://sketchfab.com/3d-models/low-poly-spaceship-82f637f65f894ffe948300183ebe904d',
    author: 'Edwin3D',
    authorUrl: 'https://sketchfab.com/Edwin3D',
    license: 'CC-BY-4.0',
  },
  {
    id: 'cuberun',
    name: 'CubeRun',
    url: `${MODELS_CDN}/cuberun/spaceship.gltf`,
    scale: 0.3,
    previewScale: 0.5,
    rotation: 0,
    gameRotation: Math.PI,
    yOffset: 0.25,
    gameYOffset: 0.25,
    overheadLightIntensity: -3,
    credit: 'CubeRun',
    creditUrl: 'https://github.com/akarlsten/cuberun/tree/main/src/models',
    author: 'Adam Karlsten',
    authorUrl: 'https://github.com/akarlsten',
    license: 'MIT',
  },
  {
    id: 'buster_drone',
    name: 'Buster Drone',
    url: `${MODELS_CDN}/buster_drone/scene.gltf`,
    scale: 0.5,
    previewScale: 1.0,
    rotation: Math.PI,
    gameRotation: 0,
    yOffset: 0.5,
    gameYOffset: 0.5,
    shipLightIntensity: 0.5,
    hideMeshes: ['Scheibe_Boden_0'],
    credit: 'Buster Drone',
    creditUrl: 'https://sketchfab.com/3d-models/buster-drone-294e79652f494130ad2ab00a13fdbafd',
    author: 'LaVADraGoN',
    authorUrl: 'https://sketchfab.com/lavadragon',
    license: 'CC-BY-4.0',
  },
  {
    id: 'boot',
    name: 'Low Poly Boot',
    url: `${MODELS_CDN}/low_poly_boot/scene.gltf`,
    scale: 2.125,
    previewScale: 4.25,
    rotation: 0,
    gameRotation: Math.PI,
    yOffset: 0.05,
    gameYOffset: 0.05,
    overheadLightIntensity: 3,
    credit: 'Low Poly Boot',
    creditUrl: 'https://sketchfab.com/3d-models/low-poly-boot-21b2513827744464b8d18083042380b5',
    author: 'Sergey Egelsky',
    authorUrl: 'https://sketchfab.com/egelsky',
    license: 'CC-BY-4.0',
  },
  {
    id: 'banana_duck',
    name: 'Banana Duck',
    url: `${MODELS_CDN}/banana_duck/scene.gltf`,
    scale: 0.33,
    previewScale: 0.67,
    rotation: 0,
    gameRotation: Math.PI,
    yOffset: -0.4,
    gameYOffset: -0.4,
    shipLightIntensity: 0.5,
    credit: 'Banana Duck',
    creditUrl: 'https://sketchfab.com/3d-models/banana-duck-e542871d099947de88212a4a86315a40',
    author: 'catl3rs',
    authorUrl: 'https://sketchfab.com/catwithantlers',
    license: 'CC-BY-4.0',
  },
  {
    id: 'silly_potato',
    name: 'Silly Potato',
    url: `${MODELS_CDN}/silly_potato/scene.gltf`,
    scale: 1.125,
    previewScale: 2.25,
    rotation: 0,
    gameRotation: Math.PI,
    yOffset: 0.5,
    gameYOffset: 0.5,
    shipLightIntensity: 0.5,
    credit: 'Silly Potato',
    creditUrl: 'https://sketchfab.com/3d-models/silly-potato-7c55aebfa724441190ed8ef9d8deca0d',
    author: 'Norod78',
    authorUrl: 'https://sketchfab.com/Norod',
    license: 'CC-BY-4.0',
  },
  {
    id: 'starman',
    name: 'Star Man',
    url: `${MODELS_CDN}/starman/scene.gltf`,
    scale: 13.4,
    previewScale: 26.8,
    rotation: 0,
    gameRotation: Math.PI,
    shipLightIntensity: 0.1,
    credit: 'Star Man - Earthbound',
    creditUrl:
      'https://sketchfab.com/3d-models/star-man-earthbound-51b87ab2a6274a8683dca20859868a78',
    author: 'timRAGE90',
    authorUrl: 'https://sketchfab.com/timRAGE90',
    license: 'CC-BY-4.0',
  },
  {
    id: 'space_woman',
    name: 'Space Woman',
    url: `${MODELS_CDN}/space_woman/scene.gltf`,
    scale: 0.5,
    previewScale: 1.0,
    rotation: 0,
    gameRotation: Math.PI,
    yOffset: -0.4,
    gameYOffset: -0.4,
    shipLightIntensity: 0.5,
    credit: 'In Space (Female)',
    creditUrl: 'https://sketchfab.com/3d-models/in-space-female-cc360b08e6fc42e2814c6ee781ea0618',
    author: 'Vintar',
    authorUrl: 'https://sketchfab.com/vintar',
    license: 'CC-BY-4.0',
  },
]

// Shared loader instances
let gltfLoader: any = null
let dracoLoader: any = null

function getLoader() {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader()
    dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/')
    gltfLoader.setDRACOLoader(dracoLoader)
  }
  return gltfLoader
}

export interface LoadedShipModel {
  model: THREE.Object3D
  animations: THREE.AnimationClip[]
  mixer: THREE.AnimationMixer | null
}

/**
 * Load a ship model into a THREE.Group
 */
export function loadShipModel(
  config: ShipConfig,
  group: THREE.Group,
  usePreviewScale = false,
  onLoad?: (result: LoadedShipModel) => void,
) {
  const loader = getLoader()
  const scale = usePreviewScale ? config.previewScale : config.scale
  const rotation = usePreviewScale ? config.rotation : config.gameRotation

  loader.load(
    config.url,
    (gltf: any) => {
      // Clear existing children
      while (group.children.length) {
        group.remove(group.children[0])
      }
      const model = gltf.scene
      model.scale.set(scale, scale, scale)
      model.rotation.y = rotation
      const yOffset = usePreviewScale ? config.yOffset : config.gameYOffset
      if (yOffset) model.position.y = yOffset
      // Hide specified meshes (e.g. ground planes)
      if (config.hideMeshes?.length) {
        model.traverse((child: any) => {
          if (config.hideMeshes!.includes(child.name)) {
            child.visible = false
          }
        })
      }
      group.add(model)

      // Create mixer if there are animations
      const animations = gltf.animations || []
      const mixer = animations.length > 0 ? new THREE.AnimationMixer(model) : null

      onLoad?.({ model, animations, mixer })
    },
    undefined,
    (error: any) => {
      console.warn('Could not load ship model:', error.message)
    },
  )
}

/**
 * Get ship config by ID, defaulting to first ship
 */
export function getShipConfig(id: string): ShipConfig {
  return SHIPS.find(s => s.id === id) || SHIPS[0]
}
