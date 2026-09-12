import { describe, expect, it } from 'vitest';
import { Group, Mesh } from 'three';
import { ComponentRegistry } from './component-registry';

describe('ComponentRegistry', () => {
  it('finds a component from a nested render object', () => {
    const registry = new ComponentRegistry();
    const group = new Group();
    const child = new Mesh();
    group.add(child);
    registry.register(group, {
      id: 'J01',
      name: 'Joint',
      type: 'Joint',
      material: 'Steel',
      telemetryChannel: 'joint-1',
    });
    expect(registry.fromObject(child)?.id).toBe('J01');
    expect(registry.values()).toHaveLength(1);
  });

  it('returns undefined for an unregistered object', () => {
    expect(new ComponentRegistry().fromObject(new Group())).toBeUndefined();
  });

  it('rejects duplicate semantic IDs instead of silently replacing a component', () => {
    const registry = new ComponentRegistry();
    const metadata = {
      id: 'J01',
      name: 'Joint',
      type: 'Joint' as const,
      material: 'Steel',
      telemetryChannel: 'joint-1',
    };
    registry.register(new Group(), metadata);
    expect(() => registry.register(new Group(), metadata)).toThrow('Duplicate component ID');
    expect(registry.size).toBe(1);
  });
});
