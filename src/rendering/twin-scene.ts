import * as THREE from 'three';
import { APP_CONFIG, type VisualMode } from '../config';
import { ComponentRegistry } from '../digital-twin/component-registry';
import { createProceduralRobot } from '../digital-twin/procedural-robot';
import {
  loadGltfModel,
  type GltfModelSource,
  type LoadedTwinModel,
} from '../digital-twin/gltf-model-loader';
import { disposeObject3D, objectMaterials } from '../digital-twin/model-utils';
import type { TwinComponent } from '../digital-twin/types';

export interface TransformSnapshot {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
}

export interface ModelSummary {
  label: string;
  source: 'procedural' | 'url' | 'file';
  componentCount: number;
  appliedScale: number;
}

interface MaterialSnapshot {
  color?: number;
  emissive?: number;
  emissiveIntensity?: number;
  opacity: number;
  transparent: boolean;
  visible: boolean;
  wireframe?: boolean;
  depthWrite: boolean;
}

interface ExplodeState {
  object: THREE.Object3D;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  distance: number;
}

type ComponentSelectionListener = (component?: TwinComponent) => void;

function colorProperty(
  material: THREE.Material,
  name: 'color' | 'emissive',
): THREE.Color | undefined {
  const value = (material as unknown as Record<string, unknown>)[name];
  return value instanceof THREE.Color ? value : undefined;
}

function numericProperty(material: THREE.Material, name: string): number | undefined {
  const value = (material as unknown as Record<string, unknown>)[name];
  return typeof value === 'number' ? value : undefined;
}

function booleanProperty(material: THREE.Material, name: string): boolean | undefined {
  const value = (material as unknown as Record<string, unknown>)[name];
  return typeof value === 'boolean' ? value : undefined;
}

export class TwinScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly root = new THREE.Group();
  registry: ComponentRegistry;
  readonly #container: HTMLElement;
  readonly #raycaster = new THREE.Raycaster();
  readonly #pointer = new THREE.Vector2();
  readonly #resizeObserver: ResizeObserver;
  readonly #proceduralModel: THREE.Group;
  readonly #proceduralRegistry: ComponentRegistry;
  readonly #proceduralExplodable: THREE.Object3D[];
  readonly #materialSnapshots = new WeakMap<THREE.Material, MaterialSnapshot>();
  readonly #initialVisibility = new Map<THREE.Object3D, boolean>();
  readonly #transparentComponents = new Set<THREE.Object3D>();
  #activeModel: THREE.Object3D;
  #importedModel?: LoadedTwinModel;
  #explodeStates: ExplodeState[] = [];
  #selection?: TwinComponent;
  #selectionListener?: ComponentSelectionListener;
  #mode: VisualMode = 'holographic';
  #explode = 0;
  #frameHandle = 0;
  #lastTime = performance.now();
  #frames = 0;
  #fps = 0;
  #modelOperation = 0;
  #disposed = false;

  constructor(container: HTMLElement) {
    this.#container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, APP_CONFIG.rendering.maxPixelRatio));
    this.renderer.setClearColor(APP_CONFIG.rendering.background, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Interactive robotic digital twin viewport',
    );
    container.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(APP_CONFIG.rendering.fov, 1, 0.1, 100);
    this.camera.position.set(0.2, 2.35, 8.3);
    this.camera.lookAt(0, 1, 0);

    const built = createProceduralRobot();
    this.#proceduralModel = built.root;
    this.#proceduralRegistry = built.registry;
    this.#proceduralExplodable = built.explodable;
    this.#activeModel = built.root;
    this.registry = built.registry;
    this.root.name = 'Twin transform root';
    this.root.add(this.#activeModel);
    this.scene.add(this.root);
    this.configureActiveModel(built.explodable);

    this.scene.add(new THREE.HemisphereLight(0x8feaff, 0x020609, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(4, 7, 6);
    this.scene.add(key);
    const cyanRim = new THREE.PointLight(APP_CONFIG.colors.cyan, 28, 15, 2);
    cyanRim.position.set(-4, 2, -2);
    this.scene.add(cyanRim);
    const amberRim = new THREE.PointLight(APP_CONFIG.colors.amber, 18, 12, 2);
    amberRim.position.set(4, 1, 2);
    this.scene.add(amberRim);

    const grid = new THREE.GridHelper(22, 44, 0x0c6774, 0x062b34);
    grid.position.y = -1.44;
    this.scene.add(grid);

    const starGeometry = new THREE.BufferGeometry();
    const points = new Float32Array(330 * 3);
    for (let index = 0; index < points.length; index += 3) {
      const radius = 7 + Math.random() * 7;
      const angle = Math.random() * Math.PI * 2;
      points[index] = Math.cos(angle) * radius;
      points[index + 1] = Math.random() * 8 - 2;
      points[index + 2] = Math.sin(angle) * radius;
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    this.scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
          color: APP_CONFIG.colors.cyan,
          size: 0.018,
          transparent: true,
          opacity: 0.32,
        }),
      ),
    );

    this.resetTransform();
    this.resize();
    this.#resizeObserver = new ResizeObserver(this.resize);
    this.#resizeObserver.observe(container);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.animate();
  }

  onSelection(listener: ComponentSelectionListener): void {
    this.#selectionListener = listener;
  }

  get selection(): TwinComponent | undefined {
    return this.#selection;
  }

  get modelSummary(): ModelSummary {
    return this.#importedModel
      ? {
          label: this.#importedModel.label,
          source: this.#importedModel.source,
          componentCount: this.#importedModel.componentCount,
          appliedScale: this.#importedModel.appliedScale,
        }
      : {
          label: 'Articulated inspection cell',
          source: 'procedural',
          componentCount: this.registry.size,
          appliedScale: 1,
        };
  }

  selectAt(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.#pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.selectFromPointer();
  }

  selectNormalized(x: number, y: number): TwinComponent | undefined {
    this.#pointer.set(
      THREE.MathUtils.clamp(x, 0, 1) * 2 - 1,
      -(THREE.MathUtils.clamp(y, 0, 1) * 2 - 1),
    );
    return this.selectFromPointer();
  }

  select(component?: TwinComponent): void {
    this.#selection = component;
    this.applyMaterials();
    this.#selectionListener?.(component);
  }

  setVisualMode(mode: VisualMode): void {
    this.#mode = mode;
    this.applyMaterials();
  }

  translate(dx: number, dy: number, dz: number): void {
    this.root.position.x = THREE.MathUtils.clamp(this.root.position.x + dx, -3.5, 3.5);
    this.root.position.y = THREE.MathUtils.clamp(this.root.position.y + dy, -2.25, 1.5);
    this.root.position.z = THREE.MathUtils.clamp(this.root.position.z + dz, -3, 3);
  }

  rotate(delta: number): void {
    this.root.rotation.y += delta;
  }

  scale(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    const next = THREE.MathUtils.clamp(
      this.root.scale.x * delta,
      APP_CONFIG.interaction.minScale,
      APP_CONFIG.interaction.maxScale,
    );
    this.root.scale.setScalar(next);
  }

  setExploded(value: number): void {
    this.#explode = THREE.MathUtils.clamp(value, 0, 1);
    for (const state of this.#explodeStates) {
      state.object.position
        .copy(state.origin)
        .addScaledVector(state.direction, this.#explode * state.distance);
    }
  }

  get exploded(): number {
    return this.#explode;
  }

  toggleExploded(): void {
    this.setExploded(this.#explode > 0.1 ? 0 : 1);
  }

  isolate(component = this.#selection): void {
    if (!component) return;
    this.restoreVisibility();
    for (const candidate of this.registry.values()) {
      const related =
        candidate === component ||
        this.isAncestor(candidate.object, component.object) ||
        this.isAncestor(component.object, candidate.object);
      candidate.object.visible = related;
    }
  }

  toggleVisibility(component = this.#selection): void {
    if (!component) return;
    component.object.visible = !component.object.visible;
  }

  isTransparent(component = this.#selection): boolean {
    return component ? this.#transparentComponents.has(component.object) : false;
  }

  toggleTransparency(component = this.#selection): void {
    if (!component) return;
    if (this.#transparentComponents.has(component.object)) {
      this.#transparentComponents.delete(component.object);
    } else {
      this.#transparentComponents.add(component.object);
    }
    this.applyMaterials();
  }

  restoreVisibility(): void {
    for (const component of this.registry.values()) {
      component.object.visible = this.#initialVisibility.get(component.object) ?? true;
    }
    this.#transparentComponents.clear();
    this.applyMaterials();
  }

  reset(): void {
    this.resetTransform();
    this.setExploded(0);
    this.restoreVisibility();
    this.select(undefined);
  }

  snapshot(): TransformSnapshot {
    return {
      x: this.root.position.x,
      y: this.root.position.y + 1.25,
      z: this.root.position.z,
      rotationY: this.root.rotation.y,
      scale: this.root.scale.x,
    };
  }

  diagnostics(): {
    fps: number;
    triangles: number;
    objects: number;
    geometries: number;
    textures: number;
  } {
    return {
      fps: this.#fps,
      triangles: this.renderer.info.render.triangles,
      objects: this.registry.size,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }

  async loadGltf(source: GltfModelSource): Promise<ModelSummary> {
    if (this.#disposed) throw new Error('Twin scene has been disposed');
    const operation = ++this.#modelOperation;
    const loaded = await loadGltfModel(source);
    if (operation !== this.#modelOperation || this.#disposed) {
      loaded.dispose();
      throw new DOMException('Model load was superseded', 'AbortError');
    }
    this.removeImportedModel();
    this.root.remove(this.#activeModel);
    this.#activeModel = loaded.root;
    this.#importedModel = loaded;
    this.registry = loaded.registry;
    this.root.add(loaded.root);
    this.configureActiveModel(loaded.explodable);
    this.reset();
    return this.modelSummary;
  }

  restoreProceduralModel(): ModelSummary {
    this.#modelOperation += 1;
    if (this.#activeModel !== this.#proceduralModel) this.root.remove(this.#activeModel);
    this.removeImportedModel();
    this.#activeModel = this.#proceduralModel;
    this.registry = this.#proceduralRegistry;
    if (this.#proceduralModel.parent !== this.root) this.root.add(this.#proceduralModel);
    this.configureActiveModel(this.#proceduralExplodable);
    this.reset();
    return this.modelSummary;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#modelOperation += 1;
    cancelAnimationFrame(this.#frameHandle);
    this.#resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    const proceduralIsActive = this.#activeModel === this.#proceduralModel;
    this.removeImportedModel();
    disposeObject3D(this.scene);
    if (!proceduralIsActive) disposeObject3D(this.#proceduralModel);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.#initialVisibility.clear();
    this.#transparentComponents.clear();
    this.#explodeStates = [];
    this.#selectionListener = undefined;
  }

  private selectFromPointer(): TwinComponent | undefined {
    this.#raycaster.setFromCamera(this.#pointer, this.camera);
    const intersections = this.#raycaster.intersectObject(this.#activeModel, true);
    const component = intersections
      .map((hit) => this.registry.fromObject(hit.object))
      .find((candidate): candidate is TwinComponent => candidate !== undefined);
    this.select(component);
    return component;
  }

  private configureActiveModel(explodable: THREE.Object3D[]): void {
    this.#selection = undefined;
    this.#initialVisibility.clear();
    this.#transparentComponents.clear();
    for (const component of this.registry.values()) {
      this.#initialVisibility.set(component.object, component.object.visible);
    }
    this.#explodeStates = explodable.map((object, index) => ({
      object,
      origin: object.position.clone(),
      direction: new THREE.Vector3(
        Math.cos(index * 1.7),
        0.35 + index * 0.08,
        Math.sin(index * 1.7),
      ).normalize(),
      distance: APP_CONFIG.interaction.explodeDistance * (1 + index * 0.08),
    }));
    this.captureMaterials(this.#activeModel);
    this.applyMaterials();
    this.#selectionListener?.(undefined);
  }

  private captureMaterials(root: THREE.Object3D): void {
    root.traverse((object) => {
      if (!(
        object instanceof THREE.Mesh ||
        object instanceof THREE.Line ||
        object instanceof THREE.Points
      ))
        return;
      const materials = objectMaterials(object);
      for (const material of materials) {
        if (this.#materialSnapshots.has(material)) continue;
        this.#materialSnapshots.set(material, {
          color: colorProperty(material, 'color')?.getHex(),
          emissive: colorProperty(material, 'emissive')?.getHex(),
          emissiveIntensity: numericProperty(material, 'emissiveIntensity'),
          opacity: material.opacity,
          transparent: material.transparent,
          visible: material.visible,
          wireframe: booleanProperty(material, 'wireframe'),
          depthWrite: material.depthWrite,
        });
      }
    });
  }

  private applyMaterials(): void {
    this.#activeModel.traverse((object) => {
      if (!(
        object instanceof THREE.Mesh ||
        object instanceof THREE.Line ||
        object instanceof THREE.Points
      ))
        return;
      const component = this.registry.fromObject(object);
      const selected = component !== undefined && component === this.#selection;
      const faded = component ? this.#transparentComponents.has(component.object) : false;
      const materials = objectMaterials(object);
      for (const material of materials) this.applyMaterial(material, object, selected, faded);
    });
  }

  private applyMaterial(
    material: THREE.Material,
    object: THREE.Object3D,
    selected: boolean,
    faded: boolean,
  ): void {
    const original = this.#materialSnapshots.get(material);
    if (!original) return;
    const color = colorProperty(material, 'color');
    const emissive = colorProperty(material, 'emissive');
    if (original.color !== undefined) color?.setHex(original.color);
    if (original.emissive !== undefined) emissive?.setHex(original.emissive);
    if (original.emissiveIntensity !== undefined) {
      (material as unknown as { emissiveIntensity: number }).emissiveIntensity =
        original.emissiveIntensity;
    }
    if (original.wireframe !== undefined) {
      (material as unknown as { wireframe: boolean }).wireframe = original.wireframe;
    }
    material.opacity = original.opacity;
    material.transparent = original.transparent;
    material.visible = original.visible;
    material.depthWrite = original.depthWrite;

    if (object.userData.isEdge === true) {
      material.visible = this.#mode !== 'solid';
      color?.setHex(selected ? APP_CONFIG.colors.amber : APP_CONFIG.colors.cyan);
      material.transparent = true;
      material.opacity = faded ? 0.18 : selected ? 1 : this.#mode === 'blueprint' ? 0.9 : 0.58;
      return;
    }

    if (this.#mode === 'solid') {
      if (selected) {
        color?.setHex(0x8b5b1e);
        emissive?.setHex(0x744113);
        if (original.emissiveIntensity !== undefined) {
          (material as unknown as { emissiveIntensity: number }).emissiveIntensity = 0.7;
        }
      }
      if (faded) {
        material.transparent = true;
        material.opacity = 0.18;
        material.depthWrite = false;
      }
      return;
    }

    color?.setHex(selected ? 0x8b5b1e : this.#mode === 'blueprint' ? 0x174853 : 0x0c6f80);
    emissive?.setHex(selected ? 0x744113 : APP_CONFIG.colors.cyanSoft);
    if (original.emissiveIntensity !== undefined) {
      (material as unknown as { emissiveIntensity: number }).emissiveIntensity = selected
        ? 0.85
        : 0.4;
    }
    if (original.wireframe !== undefined) {
      (material as unknown as { wireframe: boolean }).wireframe = this.#mode === 'diagnostic';
    }
    material.transparent = true;
    material.opacity = faded
      ? 0.18
      : this.#mode === 'blueprint'
        ? 0.16
        : this.#mode === 'diagnostic'
          ? 0.62
          : 0.72;
    material.depthWrite = material.opacity >= 0.5;
  }

  private removeImportedModel(): void {
    const imported = this.#importedModel;
    this.#importedModel = undefined;
    if (!imported) return;
    imported.root.removeFromParent();
    imported.dispose();
  }

  private isAncestor(candidate: THREE.Object3D, object: THREE.Object3D): boolean {
    let cursor = object.parent;
    while (cursor) {
      if (cursor === candidate) return true;
      cursor = cursor.parent;
    }
    return false;
  }

  private resetTransform(): void {
    this.root.position.set(0, -1.25, 0);
    this.root.rotation.set(0, -0.44, 0);
    this.root.scale.setScalar(1);
  }

  private resize = (): void => {
    if (this.#disposed) return;
    const width = Math.max(this.#container.clientWidth, 1);
    const height = Math.max(this.#container.clientHeight, 1);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, APP_CONFIG.rendering.maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private handlePointerDown = (event: PointerEvent): void => {
    this.selectAt(event);
  };

  private animate = (): void => {
    if (this.#disposed) return;
    this.#frameHandle = requestAnimationFrame(this.animate);
    const now = performance.now();
    this.#frames += 1;
    if (now - this.#lastTime >= 1000) {
      this.#fps = (this.#frames * 1000) / (now - this.#lastTime);
      this.#frames = 0;
      this.#lastTime = now;
    }
    this.renderer.render(this.scene, this.camera);
  };
}
