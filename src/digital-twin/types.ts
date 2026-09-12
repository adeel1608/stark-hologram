import type { Object3D } from 'three';

export interface ComponentMetadata {
  id: string;
  name: string;
  type: 'Assembly' | 'Base' | 'Joint' | 'Link' | 'Tool' | 'Workpiece' | 'Cell' | 'Component';
  material: string;
  telemetryChannel: string;
}

export type ComponentType = ComponentMetadata['type'];

export interface TwinComponent extends ComponentMetadata {
  object: Object3D;
}
