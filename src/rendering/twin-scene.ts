import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { APP_CONFIG, type VisualMode } from '../config';
import { createProceduralRobot } from '../digital-twin/procedural-robot';
import type { TwinComponent } from '../digital-twin/types';

export interface TransformSnapshot {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
}

type ComponentSelectionListener = (component?: TwinComponent) => void;

export class TwinScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly root: THREE.Group;
  readonly registry;
  readonly #container: HTMLElement;
  readonly #raycaster = new THREE.Raycaster();
  readonly #pointer = new THREE.Vector2();
  readonly #explodable: THREE.Object3D[];
  readonly #initialExplodePositions = new Map<THREE.Object3D, THREE.Vector3>();
  #selection?: TwinComponent;
  #selectionListener?: ComponentSelectionListener;
  #mode: VisualMode = 'holographic';
  #explode = 0;
  #frameHandle = 0;
  #lastTime = performance.now();
  #frames = 0;
  #fps = 0;

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
    container.append(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(APP_CONFIG.rendering.fov, 1, 0.1, 100);
    this.camera.position.set(0.2, 2.35, 8.3);
    this.camera.lookAt(0, 1, 0);

    const built = createProceduralRobot();
    this.root = built.root;
    this.registry = built.registry;
    this.#explodable = built.explodable;
    for (const object of this.#explodable) {
      this.#initialExplodePositions.set(object, object.position.clone());
    }
    this.scene.add(this.root);

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

    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.renderer.domElement.addEventListener('pointerdown', (event) => this.selectAt(event));
    this.animate();
  }

  onSelection(listener: ComponentSelectionListener): void {
    this.#selectionListener = listener;
  }

  selectAt(event: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.#pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.selectFromPointer();
  }

  selectNormalized(x: number, y: number): TwinComponent | undefined {
    this.#pointer.set(x * 2 - 1, -(y * 2 - 1));
    return this.selectFromPointer();
  }

  private selectFromPointer(): TwinComponent | undefined {
    this.#raycaster.setFromCamera(this.#pointer, this.camera);
    const intersections = this.#raycaster.intersectObject(this.root, true);
    const component = intersections
      .map((hit) => this.registry.fromObject(hit.object))
      .find((candidate): candidate is TwinComponent => candidate !== undefined);
    this.select(component);
    return component;
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
    const next = THREE.MathUtils.clamp(
      this.root.scale.x * delta,
      APP_CONFIG.interaction.minScale,
      APP_CONFIG.interaction.maxScale,
    );
    this.root.scale.setScalar(next);
  }

  setExploded(value: number): void {
    this.#explode = THREE.MathUtils.clamp(value, 0, 1);
    this.#explodable.forEach((object, index) => {
      const origin = this.#initialExplodePositions.get(object);
      if (!origin) return;
      const direction = new THREE.Vector3(
        Math.cos(index * 1.7),
        0.35 + index * 0.08,
        Math.sin(index * 1.7),
      ).normalize();
      object.position
        .copy(origin)
        .addScaledVector(
          direction,
          this.#explode * APP_CONFIG.interaction.explodeDistance * (1 + index * 0.08),
        );
    });
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

  toggleTransparency(component = this.#selection): void {
    if (!component) return;
    component.object.userData.forceTransparent = !component.object.userData.forceTransparent;
    this.applyMaterials();
  }

  restoreVisibility(): void {
    for (const component of this.registry.values()) {
      component.object.visible = true;
      component.object.userData.forceTransparent = false;
    }
    this.applyMaterials();
  }

  reset(): void {
    this.root.position.set(0, -1.25, 0);
    this.root.rotation.set(0, -0.44, 0);
    this.root.scale.setScalar(1);
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

  diagnostics(): { fps: number; triangles: number; objects: number } {
    return {
      fps: this.#fps,
      triangles: this.renderer.info.render.triangles,
      objects: this.registry.values().length,
    };
  }

  async loadGltf(url: string): Promise<THREE.Object3D> {
    const gltf = await new GLTFLoader().loadAsync(url);
    this.root.add(gltf.scene);
    return gltf.scene;
  }

  dispose(): void {
    cancelAnimationFrame(this.#frameHandle);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private applyMaterials(): void {
    for (const component of this.registry.values()) {
      const selected = component === this.#selection;
      const forceTransparent = component.object.userData.forceTransparent === true;
      component.object.traverse((child) => {
        if (child.userData.isEdge && child instanceof THREE.LineSegments) {
          const material = child.material as THREE.LineBasicMaterial;
          material.visible = this.#mode !== 'solid';
          material.color.setHex(selected ? APP_CONFIG.colors.amber : APP_CONFIG.colors.cyan);
          material.opacity = selected ? 1 : this.#mode === 'blueprint' ? 0.9 : 0.58;
        }
        if (!(child instanceof THREE.Mesh)) return;
        const material = child.material as THREE.MeshStandardMaterial;
        material.wireframe = this.#mode === 'diagnostic';
        material.color.setHex(selected ? 0x8b5b1e : this.#mode === 'solid' ? 0x2b5963 : 0x0c6f80);
        material.emissive.setHex(selected ? 0x744113 : APP_CONFIG.colors.cyanSoft);
        material.emissiveIntensity = this.#mode === 'solid' ? 0.12 : selected ? 0.85 : 0.4;
        material.transparent = this.#mode !== 'solid' || forceTransparent;
        material.opacity = forceTransparent
          ? 0.18
          : this.#mode === 'blueprint'
            ? 0.05
            : this.#mode === 'solid'
              ? 1
              : 0.72;
      });
    }
  }

  private isAncestor(candidate: THREE.Object3D, object: THREE.Object3D): boolean {
    let cursor = object.parent;
    while (cursor) {
      if (cursor === candidate) return true;
      cursor = cursor.parent;
    }
    return false;
  }

  private resize(): void {
    const width = Math.max(this.#container.clientWidth, 1);
    const height = Math.max(this.#container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
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
