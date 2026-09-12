# Robotic digital twin

## Procedural reference cell

The bundled flagship is generated from Three.js primitives, avoiding an unverified third-party asset license. It includes an inspection table, rotary base, shoulder, primary link, elbow, forearm, wrist, adaptive gripper, and workpiece.

Each semantic component is registered with:

- stable ID and display name;
- engineering type and material description;
- owning Three.js object;
- telemetry channel.

Raycasting walks upward from render meshes to the nearest registered component. The registry powers highlighting, inspector metadata, telemetry binding, isolation, visibility, and component counts.

## Scene operations

- whole-model X/Y/Z translation, rotation, scaling, and reset;
- component selection and original cyan/amber highlighting;
- hierarchy-aware isolation and hide/show restore;
- deterministic radial exploded view;
- holographic, blueprint, solid, and diagnostic materials;
- local GLB and HTTP(S) GLB/glTF loading through a lazily imported Three.js `GLTFLoader`.

## Importing a model

Open **Camera & interaction → Digital twin model**. Choose either:

- a self-contained local `.glb` file up to 50 MB; or
- an HTTP(S) `.glb`/`.gltf` URL whose server permits browser CORS requests. External buffers and textures referenced by a `.gltf` file must also be reachable relative to that URL.

Local files are parsed in the browser and are not uploaded by this project. Loading a URL makes an explicit browser request to the named host; that host applies its own access logs and privacy policy.

On success, the importer:

1. clones mesh materials so highlighting one component cannot mutate another component that shared a material;
2. computes finite bounds, centers the asset, and uniformly scales its largest dimension to the inspection envelope;
3. registers every mesh as a selectable component with collision-safe IDs and naming fallbacks;
4. preserves original solid-mode material properties while applying reversible holographic modes;
5. retains the procedural model for one-click restoration; and
6. disposes geometries, cloned materials, textures, skeleton resources, listeners, and obsolete imports when replaced.

glTF node `extras` can provide semantic hints inherited by descendant meshes:

| Extra               | Meaning                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `componentId`       | Preferred stable ID; duplicate IDs receive a numeric suffix            |
| `componentName`     | Inspector display name                                                 |
| `componentType`     | Assembly, Base, Joint, Link, Tool, Workpiece, Cell, or Component       |
| `componentMaterial` | Human-readable material description                                    |
| `telemetryChannel`  | Channel passed to the active telemetry provider                        |
| `explodable`        | Set to `false` to keep the mesh fixed during exploded-view transitions |

The loader rejects empty/oversized local files, unsupported URL protocols, ambiguous extensions, zero-sized bounds, and models without selectable meshes. A failed or superseded load leaves the current model intact. No third-party robot model is bundled; contributors must document redistribution rights before committing an asset.
