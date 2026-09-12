import * as THREE from 'three';
import { APP_CONFIG } from '../config';
import { ComponentRegistry } from './component-registry';

interface RobotResult {
  root: THREE.Group;
  registry: ComponentRegistry;
  explodable: THREE.Object3D[];
}

const componentMaterial = (color: number = APP_CONFIG.colors.cyanSoft) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: APP_CONFIG.colors.cyanSoft,
    emissiveIntensity: 0.4,
    metalness: 0.72,
    roughness: 0.28,
    transparent: true,
    opacity: 0.72,
  });

function addEdges(mesh: THREE.Mesh): void {
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({
      color: APP_CONFIG.colors.cyan,
      transparent: true,
      opacity: 0.72,
    }),
  );
  edge.userData.isEdge = true;
  mesh.add(edge);
}

function mesh(geometry: THREE.BufferGeometry, material = componentMaterial()): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.castShadow = true;
  result.receiveShadow = true;
  addEdges(result);
  return result;
}

export function createProceduralRobot(): RobotResult {
  const registry = new ComponentRegistry();
  const root = new THREE.Group();
  root.name = 'Robot assembly';

  const cell = new THREE.Group();
  const table = mesh(new THREE.BoxGeometry(5.8, 0.18, 3.8), componentMaterial(0x10262d));
  table.position.y = -0.25;
  cell.add(table);
  const cellGrid = new THREE.GridHelper(5.6, 14, APP_CONFIG.colors.cyan, 0x12303a);
  cellGrid.position.y = -0.15;
  cell.add(cellGrid);
  registry.register(cell, {
    id: 'CELL-01',
    name: 'Inspection table',
    type: 'Cell',
    material: 'Anodized aluminium',
    telemetryChannel: 'cell',
  });
  root.add(cell);

  const base = mesh(new THREE.CylinderGeometry(0.8, 0.95, 0.48, 24), componentMaterial(0x0b6875));
  base.position.set(-0.65, 0.08, 0);
  registry.register(base, {
    id: 'RB-BASE',
    name: 'Rotary base',
    type: 'Base',
    material: 'Cast aluminium',
    telemetryChannel: 'base',
  });
  root.add(base);

  const shoulder = new THREE.Group();
  shoulder.position.set(-0.65, 0.5, 0);
  shoulder.add(mesh(new THREE.SphereGeometry(0.48, 22, 16)));
  registry.register(shoulder, {
    id: 'J01',
    name: 'Shoulder joint',
    type: 'Joint',
    material: 'Servo housing',
    telemetryChannel: 'joint-1',
  });
  root.add(shoulder);

  const linkOne = new THREE.Group();
  linkOne.position.set(0, 0.4, 0);
  linkOne.rotation.z = -0.38;
  const linkOneBody = mesh(new THREE.BoxGeometry(0.52, 2.35, 0.58));
  linkOneBody.position.y = 1.05;
  linkOne.add(linkOneBody);
  shoulder.add(linkOne);
  registry.register(linkOne, {
    id: 'L01',
    name: 'Primary link',
    type: 'Link',
    material: 'Carbon composite',
    telemetryChannel: 'link-1',
  });

  const elbow = new THREE.Group();
  elbow.position.set(0, 2.18, 0);
  const elbowBody = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.68, 20));
  elbowBody.rotation.x = Math.PI / 2;
  elbow.add(elbowBody);
  linkOne.add(elbow);
  registry.register(elbow, {
    id: 'J02',
    name: 'Elbow joint',
    type: 'Joint',
    material: 'Servo housing',
    telemetryChannel: 'joint-2',
  });

  const linkTwo = new THREE.Group();
  linkTwo.rotation.z = 1.14;
  const linkTwoBody = mesh(new THREE.BoxGeometry(0.42, 1.9, 0.46));
  linkTwoBody.position.y = 0.86;
  linkTwo.add(linkTwoBody);
  elbow.add(linkTwo);
  registry.register(linkTwo, {
    id: 'L02',
    name: 'Forearm link',
    type: 'Link',
    material: 'Carbon composite',
    telemetryChannel: 'link-2',
  });

  const wrist = new THREE.Group();
  wrist.position.y = 1.72;
  const wristBody = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.52, 18));
  wristBody.rotation.x = Math.PI / 2;
  wrist.add(wristBody);
  linkTwo.add(wrist);
  registry.register(wrist, {
    id: 'J03',
    name: 'Wrist joint',
    type: 'Joint',
    material: 'Servo housing',
    telemetryChannel: 'joint-3',
  });

  const tool = new THREE.Group();
  tool.position.y = 0.38;
  tool.add(mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42), componentMaterial(0x7b531c)));
  for (const x of [-0.16, 0.16]) {
    const finger = mesh(new THREE.BoxGeometry(0.08, 0.48, 0.12), componentMaterial(0x8f6826));
    finger.position.set(x, 0.43, 0);
    tool.add(finger);
  }
  wrist.add(tool);
  registry.register(tool, {
    id: 'TL-01',
    name: 'Adaptive gripper',
    type: 'Tool',
    material: 'Tool steel',
    telemetryChannel: 'tool',
  });

  const workpiece = mesh(
    new THREE.TorusKnotGeometry(0.34, 0.1, 72, 10),
    componentMaterial(0x6b491d),
  );
  workpiece.position.set(1.55, 0.18, 0.35);
  registry.register(workpiece, {
    id: 'WP-01',
    name: 'Inspection workpiece',
    type: 'Workpiece',
    material: 'Copper alloy',
    telemetryChannel: 'workpiece',
  });
  root.add(workpiece);

  return {
    root,
    registry,
    explodable: [base, shoulder, linkOne, elbow, linkTwo, wrist, tool, workpiece],
  };
}
