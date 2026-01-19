import * as THREE from "./vendor/three.module.js";

const statusEl = document.getElementById("status");
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

// ===================== CONFIG =====================
// Camera / tracking
const MIRROR_INPUT = true;
const LANDMARK_SMOOTH = 0.50; // smoother = less jitter
const JUNK_JUMP_PX = 160;     // ignore big jumps (tracking loss)

// Gesture thresholds (PRO)
// Pinch hysteresis: ON is tighter, OFF is looser (stops flicker)
const PINCH_ON_PX  = 34;
const PINCH_OFF_PX = 48;

// Fist: smaller = harder to detect fist
const FIST_THRESH = 0.15;

// Hold frames (intent gating)
// ~30 fps => 8 frames ~ 0.25s (feels intentional)
const HOLD_PINCH_FRAMES = 8;
const HOLD_FIST_FRAMES  = 8;
const HOLD_XFORM_FRAMES = 10;
const HOLD_OPENPALM_FRAMES = 10;

// Cooldowns (stops accidental repeats)
const SELECT_COOLDOWN_MS = 550;
const OPENPALM_TOGGLE_COOLDOWN_MS = 1100;

// Move tuning (PRO)
const MOVE_SENS = 0.007;          // lower = less jumpy
const MOVE_DEADZONE_PX = 7;       // ignore tiny jitters

// Transform deadzones
const SCALE_DEADZONE = 0.015;     // ignore <1.5% scale change per frame
const ROT_DEADZONE_RAD = 0.02;    // ignore < ~1.1 degrees per frame
const EXPLODE_DEADZONE_PX = 6;    // ignore tiny vertical movement

// Floor pull
const FLOOR_PULL_MAX = 2.2;
const FLOOR_PULL_SMOOTH = 0.16;

// State lock + orb placement
const MODE_LOCK_MS = 520;
const ORB_DEPTH = 4.0;

// SNAP / DOCKING (1/10)
const SNAP_POS = 0.25;
const SNAP_ROT_DEG = 15;
const SNAP_SCALE_STEP = 0.05;
const SNAP_BLEND = 0.10;
const SNAP_IDLE_DELAY_MS = 220;

// BEAM (2/10) — straight, sharp
const BEAM_POINTS = 18;
const BEAM_BLEND = 0.26;
const BEAM_BEADS = 8;
const BEAM_BEAD_SPEED = 0.0009;

// 4/10: Double thumbs-up reset (already gated)
const THUMBS_HOLD_FRAMES = 18;   // slower than before
const THUMBS_COOLDOWN_MS = 2000;

// 5/10: HUD Label
const HUD_LABEL_Y_OFFSET = 0.45;

// COLORS (minimal Stark)
const C_CYAN = 0x00ffff;
const C_AMBER = 0xffd400;
const C_BG = 0x05080d;
// ==================================================

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

function snap(v, step) { return Math.round(v / step) * step; }
function snapDegRad(rad, degStep) {
  const step = (degStep * Math.PI) / 180;
  return Math.round(rad / step) * step;
}

function mx(xNorm) { return MIRROR_INPUT ? (1 - xNorm) : xNorm; }
function dist2(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function angle2(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function emaVec2(prev, next, alpha) {
  if (!prev) return { ...next };
  return { x: lerp(prev.x, next.x, alpha), y: lerp(prev.y, next.y, alpha) };
}
function screenDeltaToWorld(dx, dy) {
  return { wx: dx * MOVE_SENS, wz: dy * MOVE_SENS };
}

// ----------------- Gesture detection ----------------
function getPinchInfo(lm, W, H) {
  const t = lm[4], i = lm[8];
  const thumb = { x: mx(t.x) * W, y: t.y * H };
  const index = { x: mx(i.x) * W, y: i.y * H };
  const pinchPoint = { x: (thumb.x + index.x) / 2, y: (thumb.y + index.y) / 2 };
  const pinchDistPx = Math.hypot(thumb.x - index.x, thumb.y - index.y);
  return { pinchPoint, pinchDistPx };
}

function isOpenPalm(lm) {
  const fingers = [[8,6],[12,10],[16,14],[20,18]];
  let extended = 0;
  for (const [tip, pip] of fingers) if (lm[tip].y < lm[pip].y) extended++;
  return extended >= 3;
}

function isFist(lm) {
  const palm = lm[9];
  const tips = [lm[8], lm[12], lm[16], lm[20]];
  let sum = 0;
  for (const t of tips) sum += Math.hypot(t.x - palm.x, t.y - palm.y);
  return (sum / tips.length) < FIST_THRESH;
}

function getFistPoint(lm, W, H) {
  const p = lm[9];
  return { x: mx(p.x) * W, y: p.y * H };
}
function getPalmPoint(lm, W, H) {
  const p = lm[9];
  return { x: mx(p.x) * W, y: p.y * H };
}

/**
 * Thumbs-up detection:
 * - thumb tip above thumb IP & MCP
 * - other fingers not extended
 */
function isThumbsUp(lm) {
  const thumbTip = lm[4], thumbIP = lm[3], thumbMCP = lm[2];
  const thumbUp = (thumbTip.y < thumbIP.y) && (thumbIP.y < thumbMCP.y);

  const fingers = [[8,6],[12,10],[16,14],[20,18]];
  let downCount = 0;
  for (const [tip, pip] of fingers) if (lm[tip].y > lm[pip].y) downCount++;

  return thumbUp && downCount >= 3;
}

// ===================== Overlay scaling =====================
let DPR = 1;
function resizeOverlay() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.width = Math.floor(window.innerWidth * DPR);
  overlay.height = Math.floor(window.innerHeight * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

// ===================== Hand smoothing =====================
let smoothedHands = [];
function smoothLandmarks(results) {
  const hands = results.multiHandLandmarks || [];
  const W = window.innerWidth, H = window.innerHeight;

  const current = hands.map(lm => lm.map(p => ({ x: mx(p.x) * W, y: p.y * H })));

  if (current.length !== smoothedHands.length) {
    smoothedHands = current.map(hand => hand.map(p => ({...p})));
    return smoothedHands;
  }

  for (let h = 0; h < current.length; h++) {
    for (let i = 0; i < current[h].length; i++) {
      const prev = smoothedHands[h][i];
      const next = current[h][i];
      const jump = Math.hypot(next.x - prev.x, next.y - prev.y);
      if (jump > JUNK_JUMP_PX) smoothedHands[h][i] = { ...next };
      else smoothedHands[h][i] = emaVec2(prev, next, LANDMARK_SMOOTH);
    }
  }
  return smoothedHands;
}

// ===================== Overlay drawing =====================
function drawHand(pts, color = "rgba(255,255,255,0.14)") {
  const bones = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
  ];

  ctx.lineWidth = 2;
  ctx.strokeStyle = color;

  for (const [a,b] of bones) {
    const A = pts[a], B = pts[b];
    if (!A || !B) continue;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(0,255,255,0.12)";
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    ctx.beginPath();
    ctx.arc(p.x, p.y, (i === 8 || i === 4) ? 3.2 : 2.0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOverlay(results, fistPoints = [], pinchRings = []) {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(window.innerWidth/2 - 10, window.innerHeight/2);
  ctx.lineTo(window.innerWidth/2 + 10, window.innerHeight/2);
  ctx.moveTo(window.innerWidth/2, window.innerHeight/2 - 10);
  ctx.lineTo(window.innerWidth/2, window.innerHeight/2 + 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const smoothed = smoothLandmarks(results);
  for (const pts of smoothed) drawHand(pts);

  for (const pr of pinchRings) {
    const { pinchPoint, pinching, isLeft } = pr;
    ctx.beginPath();
    ctx.arc(pinchPoint.x, pinchPoint.y, 10, 0, Math.PI * 2);
    ctx.lineWidth = 3;

    const col =
      (isLeft && pinching) ? "rgba(255,212,0,0.90)" :
      (pinching ? "rgba(0,255,255,0.85)" : "rgba(255,255,255,0.16)");

    ctx.strokeStyle = col;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(pinchPoint.x, pinchPoint.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }

  if (fistPoints.length === 1) {
    const p = fistPoints[0];
    const t = performance.now() * 0.01;
    const r = 18 + 3 * Math.sin(t);

    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,255,255,0.22)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,255,255,0.80)";
    ctx.stroke();
  }
}

// ===================== THREE SCENE =====================
let renderer, scene, camera;
let buildingGroup, floors = [];
let particlePoints = null;

const raycaster = new THREE.Raycaster();

const target = {
  pos: new THREE.Vector3(0, 0, 0),
  rotY: 0,
  scale: 1,
  explode: 0
};
const smooth = {
  pos: new THREE.Vector3(0, 0, 0),
  rotY: 0,
  scale: 1,
  explode: 0
};

let grabbed = false;
let wireframe = false;

let hoveredFloor = null;
let selectedFloor = null;

// floor pull
let pulling = false;
let pullStartX = 0;
let pullStartOffset = 0;

// fist move (RIGHT hand only)
let lastFist = null;
let smoothFist = null;

// two-hand pinch state
let lastTwoDist = null;
let lastTwoAngle = null;
let lastTwoMidY = null;
let smoothP1 = null;
let smoothP2 = null;

// laser
let laserLine = null;
let laserDot = null;

// 3D orbs + lock
const MODE = { IDLE: "IDLE", MOVE: "MOVE", PULL: "PULL", XFORM: "XFORM", SYS: "SYS" };
let currentMode = MODE.IDLE;
let lockUntil = 0;

let orbGroup = null;
let orbMove = null, orbPull = null, orbXform = null, orbSys = null;
let orbPos = new THREE.Vector3();
let orbTarget = new THREE.Vector3();
let orbAlpha = 0;
let orbAlphaTarget = 0;

// SNAP tracking
let lastActiveTime = 0;
let wasActive = false;

// BEAM
let beamOn = false;
let beamLine = null;
let beamGeo = null;
let beamMat = null;
let beamBeads = [];
let beamStartSmooth = new THREE.Vector3();
let beamEndSmooth = new THREE.Vector3();

// 4/10 thumbs-up state
let thumbsStreak = 0;
let lastThumbsResetTime = 0;

// 5/10 HUD label
let hudSprite = null;
let hudCanvas = null;
let hudCtx = null;
let hudTex = null;
let hudText = "";
let hudPulse = 0;

// PRO: per-hand state (hysteresis + hold)
const pinchState = {
  Left:  { active: false, hold: 0, point: null, dist: 999 },
  Right: { active: false, hold: 0, point: null, dist: 999 },
};
const fistState = { hold: 0, point: null, active: false };
const xformState = { hold: 0 };
const openPalmState = { hold: 0, lastToggleTime: 0 };
let lastSelectTime = 0;

// Convert screen to world at depth in front of camera
function screenToWorld(xPx, yPx, depth = ORB_DEPTH) {
  const ndc = new THREE.Vector3(
    (xPx / window.innerWidth) * 2 - 1,
    -((yPx / window.innerHeight) * 2 - 1),
    0.5
  );
  ndc.unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  return camera.position.clone().add(dir.multiplyScalar(depth));
}

// ======= Hand labels =======
function handsWithLabels(results) {
  const lms = results.multiHandLandmarks || [];
  const handed = results.multiHandedness || [];
  const out = [];
  for (let i = 0; i < lms.length; i++) {
    const label = handed[i]?.label || "Unknown"; // "Left" or "Right"
    out.push({ lm: lms[i], label });
  }
  return out;
}

// ===================== init =====================
function initThree() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  document.body.appendChild(renderer.domElement);

  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.left = "0";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.zIndex = "0";
  renderer.setClearColor(C_BG, 1);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(C_BG);

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 2.2, 7.5);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(4, 6, 5);
  scene.add(key);

  const rim = new THREE.DirectionalLight(C_CYAN, 0.32);
  rim.position.set(-4, 2, -5);
  scene.add(rim);

  const grid = new THREE.GridHelper(18, 36);
  grid.material.opacity = 0.05;
  grid.material.transparent = true;
  scene.add(grid);

  buildingGroup = new THREE.Group();
  scene.add(buildingGroup);

  createBuildingFloors(14);
  createParticles();
  createLaser();
  createOrbs();
  createBeam();
  createHudLabel(); // 5/10

  window.addEventListener("resize", onResize);
  onResize();

  tick();
}

function createBuildingFloors(n) {
  floors = [];
  buildingGroup.clear();

  for (let i = 0; i < n; i++) {
    const w = 2.2 - i * 0.04;
    const d = 1.6 - i * 0.03;
    const h = 0.18;

    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: C_CYAN,
      emissive: 0x001111,
      emissiveIntensity: 0.62,
      transparent: true,
      opacity: 0.30,
      roughness: 0.2,
      metalness: 0.1,
      wireframe: false
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = i * (h + 0.20);

    mesh.userData.pull = 0;
    mesh.userData.pullTarget = 0;
    mesh.userData.floorIndex = i + 1;

    const edges = new THREE.EdgesGeometry(geo);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: C_CYAN, transparent: true, opacity: 0.52 })
    );
    mesh.add(line);

    buildingGroup.add(mesh);
    floors.push(mesh);
  }

  buildingGroup.position.set(0, 0.2, 0);
}

function createParticles() {
  const N = 360;
  const pos = new Float32Array(N * 3);

  for (let i = 0; i < N; i++) {
    const r = 2.2 + Math.random() * 3.2;
    const ang = Math.random() * Math.PI * 2;
    const y = 0.2 + Math.random() * 4.5;

    pos[i*3 + 0] = Math.cos(ang) * r;
    pos[i*3 + 1] = y;
    pos[i*3 + 2] = Math.sin(ang) * r;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color: C_CYAN,
    size: 0.032,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  });

  particlePoints = new THREE.Points(geo, mat);
  scene.add(particlePoints);
}

function createLaser() {
  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0,0,0),
    new THREE.Vector3(0,0,-1),
  ]);
  const mat = new THREE.LineBasicMaterial({ color: C_CYAN, transparent: true, opacity: 0.52 });
  laserLine = new THREE.Line(geom, mat);
  laserLine.visible = false;
  scene.add(laserLine);

  const dotGeo = new THREE.SphereGeometry(0.028, 12, 12);
  const dotMat = new THREE.MeshBasicMaterial({ color: C_CYAN, transparent: true, opacity: 0.78 });
  laserDot = new THREE.Mesh(dotGeo, dotMat);
  laserDot.visible = false;
  scene.add(laserDot);
}

// ======== Orbs ========
function makeOrb(colorHex) {
  const g = new THREE.SphereGeometry(0.065, 22, 22);
  const m = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.0 });
  const s = new THREE.Mesh(g, m);

  const rg = new THREE.RingGeometry(0.095, 0.135, 48);
  const rm = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
  const r = new THREE.Mesh(rg, rm);
  r.rotation.x = Math.PI / 2;

  const group = new THREE.Group();
  group.add(s);
  group.add(r);
  group.visible = false;

  group.userData.core = s;
  group.userData.ring = r;
  return group;
}

function createOrbs() {
  orbGroup = new THREE.Group();
  scene.add(orbGroup);

  orbMove = makeOrb(C_CYAN);
  orbPull = makeOrb(C_AMBER);
  orbXform = makeOrb(C_CYAN);
  orbSys  = makeOrb(C_CYAN);

  orbGroup.add(orbMove, orbPull, orbXform, orbSys);

  orbPos.set(0, 2, 3);
  orbTarget.copy(orbPos);
}

function showOnlyOrb(mode) {
  orbMove.visible = (mode === MODE.MOVE);
  orbPull.visible = (mode === MODE.PULL);
  orbXform.visible = (mode === MODE.XFORM);
  orbSys.visible  = (mode === MODE.SYS);
}

function updateOrbVisuals(time) {
  orbPos.lerp(orbTarget, 0.18);
  orbGroup.position.copy(orbPos);

  orbAlpha = lerp(orbAlpha, orbAlphaTarget, 0.12);
  const pulse = 0.78 + 0.22 * Math.sin(time * 0.02);

  const active = [orbMove, orbPull, orbXform, orbSys].find(o => o.visible);
  if (!active) return;

  const core = active.userData.core;
  const ring = active.userData.ring;

  core.material.opacity = clamp(orbAlpha * 0.48, 0, 0.78);
  ring.material.opacity = clamp(orbAlpha * 0.44 * pulse, 0, 0.68);

  ring.rotation.z += 0.012;
  const s = 1.0 + 0.06 * Math.sin(time * 0.03);
  ring.scale.set(s, s, s);
}

// ======== ENERGY BEAM ========
function createBeam() {
  beamGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(BEAM_POINTS * 3);
  beamGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

  beamMat = new THREE.LineBasicMaterial({
    color: C_AMBER,
    transparent: true,
    opacity: 0.0
  });

  beamLine = new THREE.Line(beamGeo, beamMat);
  beamLine.visible = false;
  scene.add(beamLine);

  const beadGeo = new THREE.SphereGeometry(0.020, 12, 12);
  for (let i = 0; i < BEAM_BEADS; i++) {
    const beadMat = new THREE.MeshBasicMaterial({
      color: C_AMBER,
      transparent: true,
      opacity: 0.0,
      depthWrite: false
    });
    const bead = new THREE.Mesh(beadGeo, beadMat);
    bead.visible = false;
    scene.add(bead);
    beamBeads.push(bead);
  }

  beamStartSmooth.set(0, 0, 0);
  beamEndSmooth.set(0, 0, 0);
}

function updateBeam(time) {
  if (!beamLine) return;

  if (!beamOn || !selectedFloor || !orbPull.visible) {
    beamLine.visible = false;
    for (const b of beamBeads) b.visible = false;
    return;
  }

  const start = orbGroup.position.clone();
  const end = new THREE.Vector3();
  selectedFloor.getWorldPosition(end);

  beamStartSmooth.lerp(start, BEAM_BLEND);
  beamEndSmooth.lerp(end, BEAM_BLEND);

  const arr = beamGeo.attributes.position.array;
  for (let i = 0; i < BEAM_POINTS; i++) {
    const t = i / (BEAM_POINTS - 1);
    const p = beamStartSmooth.clone().lerp(beamEndSmooth, t);
    arr[i * 3 + 0] = p.x;
    arr[i * 3 + 1] = p.y;
    arr[i * 3 + 2] = p.z;
  }
  beamGeo.attributes.position.needsUpdate = true;

  beamLine.visible = true;
  beamMat.opacity = 0.24 + 0.09 * Math.sin(time * 0.02);

  for (let i = 0; i < beamBeads.length; i++) {
    const bead = beamBeads[i];
    bead.visible = true;

    const phase = (time * BEAM_BEAD_SPEED + i / beamBeads.length) % 1;
    const p = beamStartSmooth.clone().lerp(beamEndSmooth, phase);

    bead.position.copy(p);
    bead.material.opacity = 0.12 + 0.18 * Math.sin(time * 0.02 + i);
    const s = 0.9 + 0.18 * Math.sin(time * 0.03 + i);
    bead.scale.setScalar(s);
  }
}

// ===================== 5/10 HUD LABEL =====================
function createHudLabel() {
  hudCanvas = document.createElement("canvas");
  hudCanvas.width = 512;
  hudCanvas.height = 256;
  hudCtx = hudCanvas.getContext("2d");

  hudTex = new THREE.CanvasTexture(hudCanvas);
  hudTex.minFilter = THREE.LinearFilter;
  hudTex.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({
    map: hudTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.0
  });

  hudSprite = new THREE.Sprite(mat);
  hudSprite.scale.set(2.2, 1.1, 1);
  hudSprite.visible = false;
  scene.add(hudSprite);

  drawHudText(""); // init
}

function drawHudText(text) {
  hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);

  // panel
  hudCtx.globalAlpha = 0.18;
  hudCtx.fillStyle = "#00ffff";
  hudCtx.fillRect(70, 72, 372, 92);

  // border
  hudCtx.globalAlpha = 0.40;
  hudCtx.strokeStyle = "#00ffff";
  hudCtx.lineWidth = 2;
  hudCtx.strokeRect(70, 72, 372, 92);

  // small amber accent line (minimal)
  hudCtx.globalAlpha = 0.55;
  hudCtx.strokeStyle = "#ffd400";
  hudCtx.lineWidth = 2;
  hudCtx.beginPath();
  hudCtx.moveTo(90, 160);
  hudCtx.lineTo(420, 160);
  hudCtx.stroke();

  // text
  hudCtx.globalAlpha = 0.92;
  hudCtx.fillStyle = "#00ffff";
  hudCtx.font = "700 44px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  hudCtx.textAlign = "center";
  hudCtx.textBaseline = "middle";
  hudCtx.fillText(text || "", hudCanvas.width / 2, 118);

  // micro text
  hudCtx.globalAlpha = 0.55;
  hudCtx.font = "500 18px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  hudCtx.fillText("LOCKED TARGET", hudCanvas.width / 2, 190);

  hudTex.needsUpdate = true;
}

function setHudFloor(floor) {
  if (!floor) {
    hudText = "";
    hudSprite.visible = false;
    hudSprite.material.opacity = 0.0;
    return;
  }
  const idx = floor.userData.floorIndex || 0;
  const label = `FLOOR ${String(idx).padStart(2, "0")}`;
  if (label !== hudText) {
    hudText = label;
    drawHudText(label);
  }
  hudSprite.visible = true;
}

// ===================== Hover + Laser =====================
function updateHoverAndLaser(results) {
  const handsAll = results.multiHandLandmarks || [];
  if (handsAll.length === 0) {
    laserLine.visible = false;
    laserDot.visible = false;
    return;
  }

  const tip = handsAll[0][8];
  const xNorm = mx(tip.x);
  const yNorm = tip.y;

  const ndc = { x: (xNorm * 2 - 1), y: -(yNorm * 2 - 1) };
  raycaster.setFromCamera(ndc, camera);

  const hits = raycaster.intersectObjects(floors, false);
  const nextHover = hits.length ? hits[0].object : null;

  if (nextHover !== hoveredFloor) {
    if (hoveredFloor && hoveredFloor !== selectedFloor) setFloorHighlight(hoveredFloor, "off");
    hoveredFloor = nextHover;
    if (hoveredFloor && hoveredFloor !== selectedFloor) setFloorHighlight(hoveredFloor, "hover");
  }

  if (hits.length) {
    const p = hits[0].point;

    const pts = laserLine.geometry.attributes.position;
    pts.setXYZ(0, camera.position.x, camera.position.y, camera.position.z);
    pts.setXYZ(1, p.x, p.y, p.z);
    pts.needsUpdate = true;

    laserLine.visible = true;
    laserDot.position.copy(p);
    laserDot.visible = true;
  } else {
    laserLine.visible = false;
    laserDot.visible = false;
  }
}

function setFloorHighlight(floor, mode) {
  if (!floor) return;
  if (mode === "selected") {
    floor.material.opacity = 0.60;
    floor.material.emissiveIntensity = 0.98;
  } else if (mode === "hover") {
    floor.material.opacity = 0.42;
    floor.material.emissiveIntensity = 0.78;
  } else {
    floor.material.opacity = 0.30;
    floor.material.emissiveIntensity = 0.62;
  }
}

// ===================== PRO: gesture gating =====================
function updatePinchWithHysteresis(label, pinchDistPx, pinchPoint) {
  const s = pinchState[label];
  if (!s) return;

  s.dist = pinchDistPx;
  s.point = pinchPoint;

  // hysteresis
  if (!s.active && pinchDistPx <= PINCH_ON_PX) s.active = true;
  else if (s.active && pinchDistPx >= PINCH_OFF_PX) s.active = false;

  // hold gating
  if (s.active) s.hold = Math.min(s.hold + 1, 999);
  else s.hold = Math.max(0, s.hold - 2);
}

function pinchConfirmed(label) {
  const s = pinchState[label];
  return s && s.active && s.hold >= HOLD_PINCH_FRAMES && s.point;
}

function updateFistHold(isRightFistNow, fistPoint) {
  if (isRightFistNow) {
    fistState.hold = Math.min(fistState.hold + 1, 999);
    fistState.point = fistPoint;
    fistState.active = fistState.hold >= HOLD_FIST_FRAMES;
  } else {
    fistState.hold = Math.max(0, fistState.hold - 2);
    fistState.active = false;
    fistState.point = null;
  }
}

function updateXformHold(twoPinchesConfirmed) {
  if (twoPinchesConfirmed) xformState.hold = Math.min(xformState.hold + 1, 999);
  else xformState.hold = Math.max(0, xformState.hold - 2);
  return xformState.hold >= HOLD_XFORM_FRAMES;
}

// ===================== Reset (3/10 + 4/10) =====================
function resetAll() {
  target.pos.set(0, 0, 0);
  target.rotY = 0;
  target.scale = 1;
  target.explode = 0;

  for (const f of floors) f.userData.pullTarget = 0;

  if (hoveredFloor && hoveredFloor !== selectedFloor) setFloorHighlight(hoveredFloor, "off");
  hoveredFloor = null;

  if (selectedFloor) setFloorHighlight(selectedFloor, "off");
  selectedFloor = null;

  setHudFloor(null);

  pulling = false;
  lastFist = null;
  smoothFist = null;

  lastTwoDist = null;
  lastTwoAngle = null;
  lastTwoMidY = null;
  smoothP1 = null;
  smoothP2 = null;

  currentMode = MODE.IDLE;
  lockUntil = 0;
  orbAlphaTarget = 0;
  showOnlyOrb(MODE.IDLE);

  lastActiveTime = performance.now();
  wasActive = false;

  beamOn = false;

  pinchState.Left.active = false; pinchState.Left.hold = 0;
  pinchState.Right.active = false; pinchState.Right.hold = 0;
  fistState.hold = 0; fistState.active = false;
  xformState.hold = 0;

  statusEl.textContent = "reset.";
}

function updateThumbsReset(handsLabeled) {
  const now = performance.now();
  if (now - lastThumbsResetTime < THUMBS_COOLDOWN_MS) {
    thumbsStreak = 0;
    return;
  }

  let leftThumb = false, rightThumb = false;
  for (const h of handsLabeled) {
    if (h.label === "Left") leftThumb = isThumbsUp(h.lm);
    if (h.label === "Right") rightThumb = isThumbsUp(h.lm);
  }

  if (leftThumb && rightThumb) thumbsStreak++;
  else thumbsStreak = Math.max(0, thumbsStreak - 2);

  if (thumbsStreak >= THUMBS_HOLD_FRAMES) {
    lastThumbsResetTime = now;
    thumbsStreak = 0;
    resetAll();
  }
}

// ===================== MODE / ORB =====================
function applyModeLock(desired) {
  const now = performance.now();
  if (currentMode === MODE.IDLE && desired !== MODE.IDLE) {
    currentMode = desired;
    lockUntil = now + MODE_LOCK_MS;
    return;
  }
  if (now < lockUntil) return;

  if (desired !== currentMode) {
    currentMode = desired;
    lockUntil = now + MODE_LOCK_MS;
  }
}

function updateOrbTargetByMode({ mode, leftPinchPoint, rightFistPoint, xformMidPoint, results }) {
  const hands = results.multiHandLandmarks || [];
  const W = window.innerWidth, H = window.innerHeight;

  let screenPt = null;

  if (mode === MODE.MOVE && rightFistPoint) screenPt = rightFistPoint;
  else if (mode === MODE.PULL && leftPinchPoint) screenPt = leftPinchPoint;
  else if (mode === MODE.XFORM && xformMidPoint) screenPt = xformMidPoint;
  else if (mode === MODE.SYS && hands.length) screenPt = getPalmPoint(hands[0], W, H);

  if (!screenPt) {
    orbAlphaTarget = 0;
    showOnlyOrb(MODE.IDLE);
    return;
  }

  showOnlyOrb(mode);
  orbAlphaTarget = 1;

  const w = screenToWorld(screenPt.x, screenPt.y, ORB_DEPTH);
  w.y += 0.18;
  orbTarget.copy(w);
}

// ===================== Actions: select / pull =====================
function maybeSelectFloorLeftConfirmed(leftPinchConfirmed) {
  const now = performance.now();
  if (!leftPinchConfirmed) return;
  if (!hoveredFloor) return;
  if (now - lastSelectTime < SELECT_COOLDOWN_MS) return;

  if (selectedFloor && selectedFloor !== hoveredFloor) setFloorHighlight(selectedFloor, "off");
  selectedFloor = hoveredFloor;
  setFloorHighlight(selectedFloor, "selected");

  setHudFloor(selectedFloor);
  lastSelectTime = now;
}

function maybeFloorPullLeft(leftPinchPoint, leftPinchConfirmed) {
  if (!selectedFloor) return;

  if (!leftPinchConfirmed || !leftPinchPoint) {
    pulling = false;
    return;
  }

  if (!pulling) {
    if (hoveredFloor !== selectedFloor) return;
    pulling = true;
    pullStartX = leftPinchPoint.x;
    pullStartOffset = selectedFloor.userData.pullTarget || 0;
    statusEl.textContent = "mode: SELECT/PULL (LEFT pinch)";
    return;
  }

  const dx = leftPinchPoint.x - pullStartX;
  const worldDx = dx * 0.008;
  selectedFloor.userData.pullTarget = clamp(pullStartOffset + worldDx, -FLOOR_PULL_MAX, FLOOR_PULL_MAX);
}

// ===================== Wireframe toggle (hold open palm) =====================
function maybeToggleWireframeHold(results, hasAnyActiveGesture) {
  const now = performance.now();
  if (hasAnyActiveGesture) {
    openPalmState.hold = 0;
    return;
  }
  const handsAll = results.multiHandLandmarks || [];
  if (handsAll.length === 0) {
    openPalmState.hold = 0;
    return;
  }

  const palm = isOpenPalm(handsAll[0]);
  if (palm) openPalmState.hold++;
  else openPalmState.hold = Math.max(0, openPalmState.hold - 2);

  if (openPalmState.hold >= HOLD_OPENPALM_FRAMES && (now - openPalmState.lastToggleTime) > OPENPALM_TOGGLE_COOLDOWN_MS) {
    wireframe = !wireframe;
    openPalmState.lastToggleTime = now;
    openPalmState.hold = 0;

    for (const f of floors) f.material.wireframe = wireframe;
    statusEl.textContent = wireframe ? "wireframe: ON (hold open palm)" : "wireframe: OFF (hold open palm)";
  }
}

// ===================== MAIN DRIVER =====================
function drive3D(results) {
  const W = window.innerWidth, H = window.innerHeight;
  const hands = handsWithLabels(results);

  // 4/10: thumbs-up reset (gated)
  updateThumbsReset(hands);

  // Update hover/laser using first hand index finger
  updateHoverAndLaser(results);

  // Collect pinch + fist with PRO gating
  let rightFistNow = false;
  let rightFistPoint = null;

  // for overlay rings
  const pinchRings = [];
  const fistPoints = [];

  // reset points each frame
  pinchState.Left.point = null;
  pinchState.Right.point = null;

  // update per-hand pinch (hysteresis + hold)
  for (const h of hands) {
    const { lm, label } = h;
    const { pinchPoint, pinchDistPx } = getPinchInfo(lm, W, H);

    // track pinch state only for Left/Right
    if (label === "Left" || label === "Right") {
      updatePinchWithHysteresis(label, pinchDistPx, pinchPoint);
      pinchRings.push({ pinchPoint, pinching: pinchState[label].active, isLeft: (label === "Left") });
    } else {
      // unknown label still draw as cyan pinch ring
      pinchRings.push({ pinchPoint, pinching: (pinchDistPx <= PINCH_ON_PX), isLeft: false });
    }

    // RIGHT fist only
    if (label === "Right" && isFist(lm)) {
      rightFistNow = true;
      rightFistPoint = getFistPoint(lm, W, H);
      fistPoints.push(rightFistPoint);
    }
  }

  updateFistHold(rightFistNow, rightFistPoint);

  const leftPinchOK = pinchConfirmed("Left");
  const rightPinchOK = pinchConfirmed("Right");

  const leftPinchPoint = pinchState.Left.point;
  const rightPinchPoint = pinchState.Right.point;

  // Two-hand transform requires BOTH confirmed
  const twoPinchesConfirmed = leftPinchOK && rightPinchOK && leftPinchPoint && rightPinchPoint;
  const xformOK = updateXformHold(twoPinchesConfirmed);

  // open-palm wireframe toggle (hold + cooldown)
  const anyActiveGesture = leftPinchOK || rightPinchOK || fistState.active || xformOK || pulling;
  maybeToggleWireframeHold(results, anyActiveGesture);

  // LEFT pinch selects + pulls
  maybeSelectFloorLeftConfirmed(leftPinchOK);
  maybeFloorPullLeft(leftPinchPoint, leftPinchOK);

  // Decide desired mode (hand-specific + gated)
  let desired = MODE.IDLE;

  if (xformOK) desired = MODE.XFORM;
  else if (pulling || leftPinchOK) desired = MODE.PULL;
  else if (fistState.active && !leftPinchOK && !rightPinchOK) desired = MODE.MOVE;
  else {
    // SYS mode if first hand open palm (no gestures)
    const anyLM = results.multiHandLandmarks || [];
    if (anyLM.length && !anyActiveGesture && isOpenPalm(anyLM[0])) desired = MODE.SYS;
  }

  applyModeLock(desired);

  // Orb target per mode
  let xformMidPoint = null;
  if (twoPinchesConfirmed) {
    xformMidPoint = { x: (leftPinchPoint.x + rightPinchPoint.x) / 2, y: (leftPinchPoint.y + rightPinchPoint.y) / 2 };
  }
  updateOrbTargetByMode({
    mode: currentMode,
    leftPinchPoint: leftPinchOK ? leftPinchPoint : null,
    rightFistPoint: fistState.active ? fistState.point : null,
    xformMidPoint: xformOK ? xformMidPoint : null,
    results
  });

  // Beam only for left pinch confirmed + selected floor
  beamOn = !!(selectedFloor && leftPinchOK && orbPull.visible);

  // ===== ACTIONS =====

  // PULL mode: already handled by maybeFloorPullLeft()
  if (pulling) {
    grabbed = true;
    lastActiveTime = performance.now();
    wasActive = true;
    lastFist = null;

    statusEl.textContent = "PULL: left pinch drag (hold) • move: right fist (hold) • 👍👍 reset";
    drawOverlay(results, fistPoints, pinchRings);
    return;
  }

  // TRANSFORM mode (2-hand pinch confirmed + held)
  if (xformOK && twoPinchesConfirmed) {
    grabbed = true;
    lastActiveTime = performance.now();
    wasActive = true;

    // smooth pinch points
    smoothP1 = emaVec2(smoothP1, leftPinchPoint, 0.30);
    smoothP2 = emaVec2(smoothP2, rightPinchPoint, 0.30);

    const d = dist2(smoothP1, smoothP2);
    const a = angle2(smoothP1, smoothP2);
    const midY = (smoothP1.y + smoothP2.y) / 2;

    if (lastTwoDist != null) {
      const scaleFactor = d / lastTwoDist;
      const deltaScale = Math.abs(scaleFactor - 1);
      if (deltaScale > SCALE_DEADZONE) {
        target.scale = clamp(target.scale * scaleFactor, 0.5, 2.8);
      }
    }

    if (lastTwoAngle != null) {
      const deltaA = a - lastTwoAngle;
      if (Math.abs(deltaA) > ROT_DEADZONE_RAD) target.rotY += deltaA;
    }

    if (lastTwoMidY != null) {
      const dy = (midY - lastTwoMidY);
      if (Math.abs(dy) > EXPLODE_DEADZONE_PX) {
        target.explode = clamp(target.explode + (-dy) * 0.003, 0, 1.7);
      }
    }

    lastTwoDist = d;
    lastTwoAngle = a;
    lastTwoMidY = midY;

    statusEl.textContent = "XFORM: 2-hand pinch (hold) • 👍👍 reset";
    drawOverlay(results, fistPoints, pinchRings);
    return;
  }

  // MOVE mode (right fist confirmed + held)
  if (fistState.active && !leftPinchOK && !rightPinchOK) {
    grabbed = true;
    lastActiveTime = performance.now();
    wasActive = true;

    const p = fistState.point;
    smoothFist = emaVec2(smoothFist, p, 0.30);

    if (lastFist) {
      const dx = smoothFist.x - lastFist.x;
      const dy = smoothFist.y - lastFist.y;

      // deadzone
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx > MOVE_DEADZONE_PX || ady > MOVE_DEADZONE_PX) {
        const { wx, wz } = screenDeltaToWorld(dx, dy);
        target.pos.x = clamp(target.pos.x + wx, -4, 4);
        target.pos.z = clamp(target.pos.z + wz, -4, 4);
      }
    }

    lastFist = { ...smoothFist };

    // reset transform state when not in xform
    lastTwoDist = null;
    lastTwoAngle = null;
    lastTwoMidY = null;
    smoothP1 = null;
    smoothP2 = null;

    statusEl.textContent = "MOVE: right fist (hold) • 👍👍 reset";
    drawOverlay(results, fistPoints, pinchRings);
    return;
  }

  // IDLE
  grabbed = false;
  pulling = false;
  lastFist = null;

  if (wasActive) lastActiveTime = performance.now();
  wasActive = false;

  statusEl.textContent = selectedFloor
    ? "idle. right fist=move (hold) • 2-hand pinch=xform (hold) • left pinch=pull (hold) • 👍👍 reset"
    : "idle. right fist=move (hold) • 2-hand pinch=xform (hold) • left pinch=select (hold) • 👍👍 reset";

  drawOverlay(results, fistPoints, pinchRings);
}

// ===================== render loop =====================
function tick() {
  const a = 0.12;
  smooth.pos.lerp(target.pos, a);
  smooth.rotY = lerp(smooth.rotY, target.rotY, a);
  smooth.scale = lerp(smooth.scale, target.scale, a);
  smooth.explode = lerp(smooth.explode, target.explode, a);

  // ---- SNAP DOCKING ----
  const now = performance.now();
  const idleLongEnough = (now - lastActiveTime) > SNAP_IDLE_DELAY_MS;

  if (!grabbed && idleLongEnough) {
    const snapX = snap(target.pos.x, SNAP_POS);
    const snapZ = snap(target.pos.z, SNAP_POS);
    const snapRot = snapDegRad(target.rotY, SNAP_ROT_DEG);
    const snapScale = clamp(snap(target.scale, SNAP_SCALE_STEP), 0.5, 2.8);

    target.pos.x = lerp(target.pos.x, snapX, SNAP_BLEND);
    target.pos.z = lerp(target.pos.z, snapZ, SNAP_BLEND);
    target.rotY = lerp(target.rotY, snapRot, SNAP_BLEND);
    target.scale = lerp(target.scale, snapScale, SNAP_BLEND);
  }

  buildingGroup.position.x = smooth.pos.x;
  buildingGroup.position.z = smooth.pos.z;
  buildingGroup.rotation.y = smooth.rotY;
  buildingGroup.scale.setScalar(smooth.scale);

  // explode floors + pull offsets
  const baseGap = 0.20;
  const extra = smooth.explode * 0.35;

  for (let i = 0; i < floors.length; i++) {
    const f = floors[i];
    const h = 0.18;
    f.position.y = i * (h + baseGap + extra);

    f.userData.pull = lerp(f.userData.pull, f.userData.pullTarget, FLOOR_PULL_SMOOTH);
    f.position.x = f.userData.pull;
  }

  // hologram pulse (subtle)
  const pulse = grabbed ? (0.68 + 0.28 * Math.sin(performance.now() * 0.012)) : 0.52;
  for (const f of floors) {
    const line = f.children[0];
    if (line && line.material) {
      const extraGlow = (f === selectedFloor) ? 0.14 : 0.0;
      line.material.opacity = clamp(pulse + extraGlow, 0.18, 0.88);
    }
  }

  // laser pulse
  if (laserLine.visible) {
    laserLine.material.opacity = 0.34 + 0.16 * Math.sin(performance.now() * 0.02);
    laserDot.material.opacity = 0.60 + 0.22 * Math.sin(performance.now() * 0.02);
  }

  // particles
  if (particlePoints) {
    particlePoints.rotation.y += 0.0014;
    particlePoints.material.opacity = grabbed ? 0.22 : 0.16;
  }

  // orb + beam
  updateOrbVisuals(performance.now());
  updateBeam(performance.now());

  // 5/10 HUD label update
  if (hudSprite) {
    if (selectedFloor) {
      const pos = new THREE.Vector3();
      selectedFloor.getWorldPosition(pos);
      pos.y += HUD_LABEL_Y_OFFSET;

      hudSprite.position.copy(pos);

      hudPulse = lerp(hudPulse, 1.0, 0.06);
      const t = performance.now() * 0.008;
      const o = 0.35 + 0.20 * Math.sin(t);
      hudSprite.material.opacity = clamp(o, 0.0, 0.70);
    } else {
      hudPulse = lerp(hudPulse, 0.0, 0.08);
      hudSprite.material.opacity = lerp(hudSprite.material.opacity, 0.0, 0.10);
      if (hudSprite.material.opacity < 0.02) hudSprite.visible = false;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// ===================== Resize =====================
function onResize() {
  resizeOverlay();
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

// ===================== MediaPipe =====================
async function initHands() {
  if (typeof Hands === "undefined" || typeof Camera === "undefined") {
    statusEl.textContent = "MediaPipe not loaded (Hands/Camera missing).";
    console.error("Hands/Camera globals missing.");
    return;
  }

  statusEl.textContent = "requesting webcam...";

  const hands = new Hands({
    locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.72,
    minTrackingConfidence: 0.72
  });

  hands.onResults(drive3D);

  const cam = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480
  });

  await cam.start();
  statusEl.textContent = "online.";
}

// ===================== Boot =====================
resizeOverlay();
initThree();
initHands();

