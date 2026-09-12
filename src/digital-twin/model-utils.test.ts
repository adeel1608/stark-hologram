import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, ShaderMaterial, Texture } from 'three';
import {
  cloneModelMaterials,
  discoverModelComponents,
  disposeObject3D,
  normalizeModel,
  objectMaterials,
} from './model-utils';

describe('model utilities', () => {
  it('discovers selectable meshes with unique semantic fallbacks', () => {
    const root = new Group();
    const parent = new Group();
    parent.name = 'Arm link';
    parent.userData.componentType = 'Link';
    parent.userData.telemetryChannel = 'arm';
    parent.add(
      new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()),
      new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()),
    );
    root.add(parent);
    const result = discoverModelComponents(root);
    expect(result.registry.values().map((component) => component.id)).toEqual([
      'COMPONENT-1',
      'COMPONENT-2',
    ]);
    expect(result.registry.values().every((component) => component.type === 'Link')).toBe(true);
    expect(
      result.registry.values().every((component) => component.telemetryChannel === 'arm'),
    ).toBe(true);
  });

  it('centers and uniformly scales a model to the requested envelope', () => {
    const mesh = new Mesh(new BoxGeometry(2, 4, 1), new MeshStandardMaterial());
    mesh.position.set(8, -3, 2);
    const normalized = normalizeModel(mesh, 'Fixture', 4.6);
    expect(normalized.root.name).toBe('Fixture');
    expect(normalized.appliedScale).toBeCloseTo(1.15);
    expect(normalized.originalSize.toArray()).toEqual([2, 4, 1]);
  });

  it('clones shared materials before per-component visual mutation', () => {
    const shared = new MeshStandardMaterial({ color: 0x123456 });
    const root = new Group();
    const first = new Mesh(new BoxGeometry(), shared);
    const second = new Mesh(new BoxGeometry(), shared);
    root.add(first, second);
    cloneModelMaterials(root);
    const firstMaterial = objectMaterials(first)[0];
    const secondMaterial = objectMaterials(second)[0];
    expect(firstMaterial).not.toBe(shared);
    expect(secondMaterial).not.toBe(shared);
    expect(firstMaterial).not.toBe(secondMaterial);
  });

  it('disposes shared geometries, materials, direct textures and uniform textures once', () => {
    const geometry = new BoxGeometry();
    const directTexture = new Texture();
    const uniformTexture = new Texture();
    const material = new MeshStandardMaterial({ map: directTexture });
    const shader = new ShaderMaterial({ uniforms: { image: { value: uniformTexture } } });
    const disposeCounts = {
      geometry: vi.fn(),
      material: vi.fn(),
      directTexture: vi.fn(),
      uniformTexture: vi.fn(),
    };
    geometry.addEventListener('dispose', disposeCounts.geometry);
    material.addEventListener('dispose', disposeCounts.material);
    directTexture.addEventListener('dispose', disposeCounts.directTexture);
    uniformTexture.addEventListener('dispose', disposeCounts.uniformTexture);
    const root = new Group();
    root.add(
      new Mesh(geometry, material),
      new Mesh(geometry, material),
      new Mesh(geometry, shader),
    );
    disposeObject3D(root);
    expect(disposeCounts.geometry).toHaveBeenCalledTimes(1);
    expect(disposeCounts.material).toHaveBeenCalledTimes(1);
    expect(disposeCounts.directTexture).toHaveBeenCalledTimes(1);
    expect(disposeCounts.uniformTexture).toHaveBeenCalledTimes(1);
  });
});
