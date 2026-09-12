import * as THREE from 'three';
import { ComponentRegistry } from './component-registry';
import type { ComponentType } from './types';

const COMPONENT_TYPES = new Set<ComponentType>([
  'Assembly',
  'Base',
  'Joint',
  'Link',
  'Tool',
  'Workpiece',
  'Cell',
  'Component',
]);

export interface DiscoveredModel {
  registry: ComponentRegistry;
  explodable: THREE.Object3D[];
}

export interface NormalizedModel {
  root: THREE.Group;
  originalSize: THREE.Vector3;
  appliedScale: number;
}

function semanticValue(object: THREE.Object3D, key: string): unknown {
  let cursor: THREE.Object3D | null = object;
  while (cursor) {
    if (cursor.userData[key] !== undefined) return cursor.userData[key] as unknown;
    cursor = cursor.parent;
  }
  return undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function componentType(value: unknown): ComponentType {
  const label = stringValue(value);
  return label && COMPONENT_TYPES.has(label as ComponentType)
    ? (label as ComponentType)
    : 'Component';
}

export function objectMaterials(object: THREE.Object3D): THREE.Material[] {
  const value = (object as unknown as { material?: unknown }).material;
  const candidates = Array.isArray(value) ? value : [value];
  return candidates.filter(
    (candidate): candidate is THREE.Material => candidate instanceof THREE.Material,
  );
}

function objectGeometry(object: THREE.Object3D): THREE.BufferGeometry | undefined {
  const value = (object as unknown as { geometry?: unknown }).geometry;
  return value instanceof THREE.BufferGeometry ? value : undefined;
}

function materialLabel(mesh: THREE.Object3D): string {
  const materials = objectMaterials(mesh);
  const labels = materials.map((material) => material.name || material.type).filter(Boolean);
  return [...new Set(labels)].join(' + ') || 'Imported material';
}

function slug(value: string): string {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toUpperCase() || 'COMPONENT'
  );
}

function uniqueId(registry: ComponentRegistry, preferred: string): string {
  const base = slug(preferred).slice(0, 48);
  if (!registry.get(base)) return base;
  let suffix = 2;
  while (registry.get(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function fallbackName(mesh: THREE.Object3D, index: number): string {
  if (mesh.name.trim()) return mesh.name.trim();
  let cursor = mesh.parent;
  while (cursor) {
    if (cursor.name.trim() && cursor.type !== 'Scene')
      return `${cursor.name.trim()} · part ${index}`;
    cursor = cursor.parent;
  }
  return `Component ${index}`;
}

export function cloneModelMaterials(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points
    ))
      return;
    const materials = objectMaterials(object);
    const cloned = materials.map((material) => material.clone());
    const first = cloned[0];
    if (!first) return;
    (object as unknown as { material: THREE.Material | THREE.Material[] }).material = Array.isArray(
      (object as unknown as { material: unknown }).material,
    )
      ? cloned
      : first;
  });
}

export function discoverModelComponents(root: THREE.Object3D): DiscoveredModel {
  const registry = new ComponentRegistry();
  const explodable: THREE.Object3D[] = [];
  let index = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    index += 1;
    const name = stringValue(semanticValue(object, 'componentName')) ?? fallbackName(object, index);
    const preferredId =
      stringValue(semanticValue(object, 'componentId')) ??
      stringValue(object.name) ??
      `COMPONENT-${index}`;
    const id = uniqueId(registry, preferredId);
    registry.register(object, {
      id,
      name,
      type: componentType(semanticValue(object, 'componentType')),
      material: stringValue(semanticValue(object, 'componentMaterial')) ?? materialLabel(object),
      telemetryChannel: stringValue(semanticValue(object, 'telemetryChannel')) ?? id.toLowerCase(),
    });
    if (semanticValue(object, 'explodable') !== false) explodable.push(object);
  });
  if (registry.size === 0) throw new Error('The model contains no selectable mesh components');
  return { registry, explodable };
}

export function normalizeModel(
  model: THREE.Object3D,
  label: string,
  targetSize = 4.6,
): NormalizedModel {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  if (bounds.isEmpty()) throw new Error('The model has no finite renderable bounds');
  const size = bounds.getSize(new THREE.Vector3());
  const maximum = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maximum) || maximum <= 0) {
    throw new Error('The model has invalid or zero-sized bounds');
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const appliedScale = targetSize / maximum;
  const root = new THREE.Group();
  root.name = label;
  root.add(model);
  root.scale.setScalar(appliedScale);
  root.position.set(
    -center.x * appliedScale,
    1.15 - center.y * appliedScale,
    -center.z * appliedScale,
  );
  return { root, originalSize: size, appliedScale };
}

export function disposeObject3D(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();

  const collectMaterial = (material: THREE.Material): void => {
    if (materials.has(material)) return;
    materials.add(material);
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) textures.add(value as THREE.Texture);
    }
    const uniforms = (material as unknown as { uniforms?: Record<string, { value?: unknown }> })
      .uniforms;
    for (const uniform of Object.values(uniforms ?? {})) {
      const values = Array.isArray(uniform.value) ? uniform.value : [uniform.value];
      for (const value of values) {
        if (value instanceof THREE.Texture) textures.add(value as THREE.Texture);
      }
    }
  };

  root.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points
    ) {
      const geometry = objectGeometry(object);
      if (geometry) geometries.add(geometry);
      for (const material of objectMaterials(object)) collectMaterial(material);
    }
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}
