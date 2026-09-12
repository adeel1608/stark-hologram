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
- GLTF/GLB loading through Three.js `GLTFLoader`.

The procedural model remains the fallback even after licensed GLTF assets are added. A future import UI should validate file size/type, register semantic nodes from agreed metadata, and document every bundled asset's license.
