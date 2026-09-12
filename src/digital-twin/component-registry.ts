import type { Object3D } from 'three';
import type { ComponentMetadata, TwinComponent } from './types';

export class ComponentRegistry {
  readonly #components = new Map<string, TwinComponent>();

  register(object: Object3D, metadata: ComponentMetadata): TwinComponent {
    const component = { ...metadata, object };
    object.userData.componentId = metadata.id;
    this.#components.set(metadata.id, component);
    return component;
  }

  get(id: string): TwinComponent | undefined {
    return this.#components.get(id);
  }

  fromObject(object: Object3D | null): TwinComponent | undefined {
    let cursor = object;
    while (cursor) {
      const id = cursor.userData.componentId as string | undefined;
      if (id) return this.get(id);
      cursor = cursor.parent;
    }
    return undefined;
  }

  values(): TwinComponent[] {
    return [...this.#components.values()];
  }
}
