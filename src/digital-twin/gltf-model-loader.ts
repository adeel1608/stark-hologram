import type * as THREE from 'three';
import {
  cloneModelMaterials,
  discoverModelComponents,
  disposeObject3D,
  normalizeModel,
} from './model-utils';
import type { ComponentRegistry } from './component-registry';

const MAX_LOCAL_FILE_BYTES = 50 * 1024 * 1024;

export type GltfModelSource = { kind: 'url'; url: string } | { kind: 'file'; file: File };

export interface LoadedTwinModel {
  root: THREE.Group;
  registry: ComponentRegistry;
  explodable: THREE.Object3D[];
  label: string;
  source: 'url' | 'file';
  componentCount: number;
  appliedScale: number;
  originalSize: { x: number; y: number; z: number };
  dispose(): void;
}

export function validateModelUrl(value: string, baseUrl = globalThis.location?.href): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('Enter a GLB or glTF URL');
  let url: URL;
  try {
    url = new URL(trimmed, baseUrl);
  } catch {
    throw new Error('Enter a valid model URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Model URLs must use HTTP or HTTPS');
  }
  if (!/\.(?:glb|gltf)(?:$|[?#])/i.test(url.href)) {
    throw new Error('The URL must identify a .glb or .gltf asset');
  }
  return url.href;
}

export function validateModelFile(file: File): void {
  if (!/\.glb$/i.test(file.name)) {
    throw new Error('Local import supports self-contained .glb files; use a URL for .gltf assets');
  }
  if (file.size <= 0) throw new Error('The selected model file is empty');
  if (file.size > MAX_LOCAL_FILE_BYTES)
    throw new Error('The selected model exceeds the 50 MB limit');
}

export async function loadGltfModel(source: GltfModelSource): Promise<LoadedTwinModel> {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  let model: THREE.Object3D;
  let label: string;
  if (source.kind === 'file') {
    validateModelFile(source.file);
    const buffer = await source.file.arrayBuffer();
    const gltf = await loader.parseAsync(buffer, '');
    model = gltf.scene;
    label = source.file.name.replace(/\.glb$/i, '');
  } else {
    const url = validateModelUrl(source.url);
    const gltf = await loader.loadAsync(url);
    model = gltf.scene;
    label = decodeURIComponent(new URL(url).pathname.split('/').at(-1) ?? 'Imported model').replace(
      /\.(?:glb|gltf)$/i,
      '',
    );
  }

  try {
    cloneModelMaterials(model);
    const normalized = normalizeModel(model, label || 'Imported model');
    const discovered = discoverModelComponents(normalized.root);
    return {
      root: normalized.root,
      registry: discovered.registry,
      explodable: discovered.explodable,
      label: label || 'Imported model',
      source: source.kind,
      componentCount: discovered.registry.size,
      appliedScale: normalized.appliedScale,
      originalSize: {
        x: normalized.originalSize.x,
        y: normalized.originalSize.y,
        z: normalized.originalSize.z,
      },
      dispose: () => disposeObject3D(normalized.root),
    };
  } catch (error) {
    disposeObject3D(model);
    throw error;
  }
}
