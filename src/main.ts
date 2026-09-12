import './styles.css';
import { AudioManager } from './audio/audio-manager';
import { BenchmarkRecorder } from './benchmark/benchmark-recorder';
import { CalibrationStore } from './calibration/calibration-store';
import { CameraManager } from './camera/camera-manager';
import type { CameraOption, CameraSettings, CameraState } from './camera/types';
import type { DominantHand, VisualMode } from './config';
import { DemoProvider, type DemoPhase } from './demo/demo-provider';
import { PointerInput } from './input/pointer-input';
import { keyToCommand } from './input/keymap';
import {
  InteractionController,
  type InteractionUpdate,
} from './interaction/interaction-controller';
import { TwinScene } from './rendering/twin-scene';
import { SimulationTelemetryProvider } from './telemetry/simulation-telemetry-provider';
import { HandOverlay } from './vision/hand-overlay';
import { HandTracker } from './vision/hand-tracker';
import type { TrackingFrame } from './vision/types';

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing required element: #${id}`);
  return found as T;
}

const scene = new TwinScene(element('scene-root'));
const pointerInput = new PointerInput(scene);
const video = element<HTMLVideoElement>('camera-video');
const overlayCanvas = element<HTMLCanvasElement>('hand-overlay');
const overlay = new HandOverlay(overlayCanvas);
const camera = new CameraManager(video);
const tracker = new HandTracker();
const interaction = new InteractionController(scene);
const demo = new DemoProvider();
const telemetry = new SimulationTelemetryProvider();
const benchmark = new BenchmarkRecorder();
const audio = new AudioManager();
const calibrationStore = new CalibrationStore();
let calibration = calibrationStore.load();
let latestUpdate: InteractionUpdate | undefined;
let selectedTelemetryChannel = 'joint-1';
let toastTimer = 0;
let cameraOperation = 0;
let modelOperation = 0;

const modeCode: Record<VisualMode, string> = {
  holographic: 'HLO',
  blueprint: 'BLU',
  solid: 'SLD',
  diagnostic: 'DIA',
};

const onboardingSteps = [
  {
    title: 'Choose an input path',
    body: '<strong>Camera or deterministic demo</strong><p>Use any browser-supported webcam or virtual camera. No camera is required: <code>TRY DEMO</code> sends synthetic landmark frames through the real gesture and depth pipeline.</p>',
  },
  {
    title: 'Point, pinch, then hold',
    body: '<strong>Intent is confirmed over time</strong><p>A pointer hovers over components. Bring thumb and index finger together, then hold briefly to select and grab. Separate them to release. Hysteresis reduces rapid state changes.</p>',
  },
  {
    title: 'Move in three dimensions',
    body: '<strong>X/Y motion + relative Z</strong><p>Move a confirmed pinch laterally to translate the twin. Move your hand toward or away from the camera for normalized relative Z. The interface does not claim metric distance.</p>',
  },
  {
    title: 'Use both hands',
    body: '<strong>Rotate, scale and explode</strong><p>Confirm a pinch on both hands. Change their separation to scale, rotate the line between them to turn the twin, and move the midpoint vertically to separate components.</p>',
  },
  {
    title: 'Inspect the twin',
    body: '<strong>Every visible part has meaning</strong><p>Select joints, links, the tool or workpiece to bind simulated telemetry. Isolate or hide components, and compare holographic, blueprint, solid and diagnostic modes.</p>',
  },
  {
    title: 'Ready for interaction',
    body: '<strong>The fallback controls always work</strong><p>Drag to move, use the wheel for Z, Shift-drag to rotate and Ctrl-wheel to scale. Press <code>?</code> any time for the complete control map.</p>',
  },
];
let onboardingIndex = 0;

function openDialog(id: string): void {
  const dialog = element<HTMLDialogElement>(id);
  if (!dialog.open) dialog.showModal();
}

function showToast(message: string, duration = 2600): void {
  const toast = element('toast');
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

function setInitializationStep(id: string, text: string, state: 'ready' | 'busy' | 'error'): void {
  const row = element(id);
  row.classList.toggle('complete', state === 'ready');
  row.classList.toggle('error', state === 'error');
  const output = row.querySelector('b');
  if (output) output.textContent = text;
}

function setVisualMode(mode: VisualMode, withAudio = true): void {
  scene.setVisualMode(mode);
  for (const candidate of element('visual-mode').querySelectorAll<HTMLButtonElement>('button')) {
    candidate.setAttribute('aria-pressed', String(candidate.dataset.mode === mode));
  }
  element('mode-code').textContent = modeCode[mode];
  const label =
    mode === 'holographic' ? 'Holographic' : `${mode[0]?.toUpperCase()}${mode.slice(1)}`;
  element('mode-label').textContent = label;
  if (withAudio) audio.play('mode');
}

function updateComponentPanel(): void {
  const component = scene.selection;
  element('component-visibility').textContent =
    component?.object.visible === false
      ? 'Hidden'
      : scene.isTransparent(component)
        ? '18%'
        : '100%';
  const actionIds = ['isolate-button', 'visibility-button', 'transparency-button'] as const;
  for (const id of actionIds) element<HTMLButtonElement>(id).disabled = !component;
  element('visibility-button').textContent = component?.object.visible === false ? 'Show' : 'Hide';
  element('transparency-button').textContent = scene.isTransparent(component) ? 'Unfade' : 'Fade';
  element<HTMLSelectElement>('component-select').value = component?.id ?? '';
}

function populateComponentNavigator(): void {
  const select = element<HTMLSelectElement>('component-select');
  const selected = scene.selection?.id ?? '';
  select.replaceChildren(new Option(`${scene.modelSummary.label} · assembly`, ''));
  for (const component of scene.registry.values()) {
    select.add(new Option(`${component.id} · ${component.name}`, component.id));
  }
  select.value = scene.registry.get(selected) ? selected : '';
}

function updateModelUi(): void {
  const summary = scene.modelSummary;
  element('model-title').textContent = summary.label;
  element('model-caption').textContent =
    summary.source === 'procedural'
      ? `Procedural reference twin · ${summary.componentCount} components · simulated telemetry`
      : `Imported ${summary.source.toUpperCase()} · ${summary.componentCount} selectable meshes · simulated telemetry`;
  populateComponentNavigator();
  updateComponentPanel();
}

scene.onSelection((component) => {
  element('component-name').textContent = component?.name ?? scene.modelSummary.label;
  const modelCode = scene.modelSummary.source === 'procedural' ? 'DT–R01' : 'IMPORT';
  element('component-id').textContent = component
    ? `${modelCode} / ${component.id}`
    : `${modelCode} / ROOT`;
  element('component-type').textContent = component?.type ?? 'Assembly';
  element('component-material').textContent = component?.material ?? 'Composite';
  element('component-status').textContent = 'Simulated';
  selectedTelemetryChannel = component?.telemetryChannel ?? 'joint-1';
  updateComponentPanel();
});
updateModelUi();

async function loadModel(
  source: { kind: 'url'; url: string } | { kind: 'file'; file: File },
): Promise<void> {
  const operation = ++modelOperation;
  const status = element('model-status');
  const controls = [
    element<HTMLButtonElement>('model-url-button'),
    element<HTMLButtonElement>('model-restore-button'),
    element<HTMLInputElement>('model-file'),
  ];
  for (const control of controls) control.disabled = true;
  status.classList.remove('error');
  status.textContent = source.kind === 'file' ? `Reading ${source.file.name}…` : 'Loading model…';
  try {
    const summary = await scene.loadGltf(source);
    if (operation !== modelOperation) return;
    updateModelUi();
    status.textContent = `${summary.label} active · ${summary.componentCount} selectable mesh components · scale ${summary.appliedScale.toFixed(3)}×`;
    showToast(`Loaded ${summary.label}`);
  } catch (error) {
    if (operation !== modelOperation) return;
    status.classList.add('error');
    status.textContent =
      error instanceof Error
        ? `${error.message}. The current model remains active.`
        : 'The model could not be loaded. The current model remains active.';
  } finally {
    if (operation === modelOperation) for (const control of controls) control.disabled = false;
  }
}

function updateInteractionUi(update: InteractionUpdate): void {
  latestUpdate = update;
  overlay.draw(update.frame);
  const state = update.gesture.state;
  element('gesture-state').textContent = state;
  const handLabel = update.gesture.primary?.hand.handedness;
  const detail =
    state === 'PINCH_CANDIDATE'
      ? `Confirming ${handLabel ?? ''} pinch`
      : state === 'GRAB_ACTIVE'
        ? `${handLabel ?? ''} pinch locked · XYZ enabled`
        : state === 'TWO_HAND_ACTIVE'
          ? 'Rotate · scale · explode'
          : state === 'OPEN_PALM'
            ? 'Open palm observed'
            : state === 'HOVER'
              ? 'Point at a component'
              : 'Awaiting hand input';
  element('gesture-detail').textContent = detail;
  const relativeZ = update.depth.filtered;
  element('depth-value').textContent = update.depth.available
    ? `${relativeZ >= 0 ? '+' : ''}${relativeZ.toFixed(2)}`
    : 'CAL';
  element<HTMLMeterElement>('calibration-quality').value = update.depth.available
    ? update.depth.stability
    : update.depth.calibrationProgress;
  element('calibration-status').textContent = update.depth.available
    ? `Baseline ready · ${(update.depth.stability * 100).toFixed(0)}% temporal stability`
    : update.depth.calibrationProgress < 1
      ? `Collecting a still neutral pose · ${(update.depth.calibrationProgress * 100).toFixed(0)}%`
      : 'Pose variation is too high · hold one hand still';
  benchmark.record(update, scene.snapshot());
  if (update.depth.available && update.depth.stability > 0.85 && !calibration.neutralPalmScale) {
    calibration = {
      ...calibration,
      neutralPalmScale: update.depth.baseline,
      neutralPalmFeatures: update.depth.baselineFeatures,
      calibratedAt: new Date().toISOString(),
    };
    calibrationStore.save(calibration);
  }
  if (update.event) {
    if (update.event === 'select' || update.event === 'grab' || update.event === 'release') {
      audio.play(update.event);
    } else if (update.event === 'tracking-lost') {
      audio.play('warning');
    } else if (update.event === 'reset') {
      audio.play('reset');
    }
    if (update.event === 'reset') showToast('Two-palm reset confirmed');
  }
}

function handleTrackingFrame(frame: TrackingFrame): void {
  interaction.process(frame);
}

interaction.onUpdate(updateInteractionUi);
interaction.setDominantHand(calibration.dominantHand);
restoreSavedDepthBaseline();

function restoreSavedDepthBaseline(): void {
  if (!calibration.neutralPalmScale) return;
  interaction.depth.setBaseline({
    palmScale: calibration.neutralPalmScale,
    features: calibration.neutralPalmFeatures,
  });
}

function updateCameraUi(state: CameraState): void {
  const message = element('camera-message');
  message.classList.toggle('error', state.status === 'error');
  if (state.status === 'active') {
    message.textContent = `${state.label} · ${state.width} × ${state.height}${state.frameRate ? ` · ${state.frameRate.toFixed(0)} FPS` : ''}`;
    element('camera-resolution').textContent = `${state.width}×${state.height}`;
    element('camera-empty').hidden = true;
    element('vision-summary').textContent = 'Tracking';
    element('source-summary').textContent = 'Camera';
    setInitializationStep('camera-step', 'Active', 'ready');
  } else if (state.status === 'requesting') {
    message.textContent = 'Requesting camera access…';
    setInitializationStep('camera-step', 'Requesting', 'busy');
  } else if (state.status === 'error') {
    message.textContent = state.message;
    element('camera-empty').hidden = false;
    element('vision-summary').textContent = 'Unavailable';
    setInitializationStep('camera-step', 'Error', 'error');
    audio.play('warning');
  } else {
    message.textContent = 'Camera access starts only when requested.';
    element('camera-resolution').textContent = '—';
    if (!demo.running) element('camera-empty').hidden = false;
    setInitializationStep('camera-step', 'Standby', 'busy');
  }
}

camera.addEventListener('statechange', (event) => {
  updateCameraUi((event as CustomEvent<CameraState>).detail);
});
camera.addEventListener('deviceschange', () => void populateCameras());
tracker.addEventListener('statechange', (event) => {
  const state = (event as CustomEvent<string>).detail;
  setInitializationStep(
    'tracker-step',
    state === 'ready' ? 'Ready' : state === 'error' ? 'Error' : 'Loading',
    state === 'ready' ? 'ready' : state === 'error' ? 'error' : 'busy',
  );
});

async function populateCameras(): Promise<void> {
  const select = element<HTMLSelectElement>('camera-select');
  const selected = select.value || camera.settings.deviceId || '';
  let options: CameraOption[];
  try {
    options = await camera.enumerate();
  } catch {
    element('camera-message').textContent =
      'Camera sources could not be enumerated. The browser default may still work.';
    options = [];
  }
  select.replaceChildren(new Option('Default browser camera', ''));
  for (const option of options) select.add(new Option(option.label, option.deviceId));
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

async function startCamera(): Promise<void> {
  const operation = ++cameraOperation;
  stopDemo();
  const resolution = element<HTMLSelectElement>('resolution-select').value.split('x').map(Number);
  const settings: CameraSettings = {
    deviceId: element<HTMLSelectElement>('camera-select').value || undefined,
    width: resolution[0] ?? 960,
    height: resolution[1] ?? 540,
    frameRate: 30,
    mirror: element<HTMLInputElement>('mirror-checkbox').checked,
  };
  try {
    await camera.start(settings);
    if (operation !== cameraOperation) return;
    overlayCanvas.classList.toggle('mirrored', settings.mirror);
    await tracker.start(video, handleTrackingFrame);
    if (operation !== cameraOperation) {
      tracker.stop();
      camera.stop();
      return;
    }
    setInitializationStep('tracker-step', 'Tracking', 'ready');
    element<HTMLDialogElement>('settings-dialog').close();
    showToast('Camera and hand tracker ready');
    void populateCameras();
  } catch (error) {
    if (operation !== cameraOperation) return;
    const cameraState = camera.getState();
    const message =
      cameraState.status === 'error'
        ? cameraState.message
        : error instanceof Error
          ? error.message
          : 'Camera or tracker startup failed';
    tracker.stop();
    if (cameraState.status === 'active') camera.stop();
    element('camera-message').textContent = `${message} Demo mode remains available.`;
    element('camera-message').classList.add('error');
    setInitializationStep('tracker-step', 'Standby', 'error');
  }
}

function stopCamera(): void {
  cameraOperation += 1;
  tracker.stop();
  camera.stop();
  overlay.clear();
  element('vision-summary').textContent = 'Standby';
  setInitializationStep('tracker-step', 'Standby', 'busy');
}

function updateDemoPhase(phase: DemoPhase): void {
  const cues: Record<DemoPhase, string> = {
    hover: 'Demo · point / hover',
    grab: 'Demo · pinch / translate XY',
    depth: 'Demo · monocular relative Z',
    release: 'Demo · release',
    'two-hand': 'Demo · two-hand rotate / scale / explode',
    inspect: 'Demo · component inspection',
    reset: 'Demo · two-palm reset',
  };
  showToast(cues[phase], 1500);
  if (phase === 'hover') {
    scene.reset();
    setVisualMode('holographic', false);
  }
  if (phase === 'two-hand') setVisualMode('blueprint', false);
  if (phase === 'inspect') {
    setVisualMode('diagnostic', false);
    scene.select(scene.registry.get('J02'));
  }
  if (phase === 'reset') setVisualMode('solid', false);
}

demo.addEventListener('phasechange', (event) =>
  updateDemoPhase((event as CustomEvent<DemoPhase>).detail),
);

function startDemo(): void {
  stopCamera();
  interaction.reset({ rebaseline: true });
  scene.reset();
  element('camera-empty').hidden = true;
  element('camera-resolution').textContent = 'SYNTHETIC';
  element('source-summary').textContent = 'Demo';
  element('vision-summary').textContent = 'Synthetic';
  setInitializationStep('camera-step', 'Demo', 'ready');
  setInitializationStep('tracker-step', 'Synthetic', 'ready');
  element('demo-button').innerHTML = '<span>■</span> Stop demo';
  demo.start(handleTrackingFrame);
}

function stopDemo(): void {
  if (!demo.running) return;
  demo.stop();
  interaction.reset({ rebaseline: true });
  restoreSavedDepthBaseline();
  overlay.clear();
  element('camera-empty').hidden = false;
  element('camera-resolution').textContent = '—';
  element('source-summary').textContent = 'Simulation';
  element('vision-summary').textContent = 'Standby';
  setInitializationStep('camera-step', 'Standby', 'busy');
  setInitializationStep('tracker-step', 'Standby', 'busy');
  element('demo-button').innerHTML = '<span>▶</span> Try demo';
}

function renderOnboarding(): void {
  const step = onboardingSteps[onboardingIndex];
  if (!step) return;
  element('onboarding-title').textContent = step.title;
  element('onboarding-content').innerHTML = step.body;
  const progress = element('onboarding-progress');
  progress.replaceChildren(
    ...onboardingSteps.map((_, index) => {
      const marker = document.createElement('i');
      marker.classList.toggle('active', index <= onboardingIndex);
      return marker;
    }),
  );
  element<HTMLButtonElement>('onboarding-back').disabled = onboardingIndex === 0;
  element('onboarding-next').textContent =
    onboardingIndex === onboardingSteps.length - 1 ? 'Enter interface' : 'Next';
}

function closeOnboarding(completed: boolean): void {
  calibration = { ...calibration, onboardingComplete: completed || calibration.onboardingComplete };
  calibrationStore.save(calibration);
  element<HTMLDialogElement>('onboarding-dialog').close();
}

function updateDiagnostics(): void {
  const cameraState = camera.getState();
  const tracking = tracker.metrics;
  const render = scene.diagnostics();
  element('diag-camera-source').textContent =
    cameraState.status === 'active'
      ? cameraState.label
      : demo.running
        ? 'Synthetic demo'
        : 'Inactive';
  element('diag-camera-resolution').textContent =
    cameraState.status === 'active' ? `${cameraState.width} × ${cameraState.height}` : '—';
  element('diag-camera-fps').textContent =
    cameraState.status === 'active' && cameraState.frameRate
      ? `${cameraState.frameRate.toFixed(1)} FPS`
      : '—';
  element('diag-inference').textContent =
    latestUpdate?.frame.source === 'camera' ? `${tracking.inferenceMs.toFixed(1)} ms` : '—';
  element('diag-tracking-fps').textContent =
    latestUpdate?.frame.source === 'camera'
      ? `${tracking.trackingFps.toFixed(1)} FPS`
      : demo.running
        ? 'Display rate'
        : '—';
  element('diag-hands').textContent = String(latestUpdate?.frame.hands.length ?? 0);
  element('diag-handedness').textContent =
    latestUpdate?.frame.hands
      .map((hand) =>
        hand.handednessScore === undefined
          ? hand.handedness
          : `${hand.handedness} ${(hand.handednessScore * 100).toFixed(0)}%`,
      )
      .join(' · ') || '—';
  element('diag-gesture').textContent = latestUpdate?.gesture.state ?? 'IDLE';
  element('diag-hold').textContent = `${latestUpdate?.gesture.holdMs.toFixed(0) ?? '0'} ms`;
  element('diag-quality').textContent = latestUpdate?.gesture.primary
    ? `${(latestUpdate.gesture.heuristicQuality * 100).toFixed(0)}% heuristic`
    : '—';
  element('diag-palm-scale').textContent = latestUpdate?.depth.palmScale
    ? latestUpdate.depth.palmScale.toFixed(4)
    : '—';
  element('diag-depth').textContent = latestUpdate?.depth.available
    ? `${latestUpdate.depth.raw.toFixed(3)} / ${latestUpdate.depth.filtered.toFixed(3)}`
    : 'Calibrating';
  element('diag-baseline').textContent = latestUpdate?.depth.baseline
    ? `${latestUpdate.depth.baseline.toFixed(4)} / ${(latestUpdate.depth.stability * 100).toFixed(0)}%`
    : '—';
  element('diag-render-fps').textContent = `${render.fps.toFixed(1)} FPS`;
  element('diag-triangles').textContent = render.triangles.toLocaleString();
  element('diag-components').textContent = String(render.objects);
  element('diag-geometries').textContent = String(render.geometries);
  element('diag-textures').textContent = String(render.textures);
  element('diag-tracking-source').textContent = latestUpdate?.frame.source ?? 'None';
  element('benchmark-count').textContent = benchmark.count.toLocaleString();
}

element('visual-mode').addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-mode]');
  if (button?.dataset.mode) setVisualMode(button.dataset.mode as VisualMode);
});

element('component-select').addEventListener('change', (event) => {
  const id = (event.target as HTMLSelectElement).value;
  scene.select(id ? scene.registry.get(id) : undefined);
});
element('isolate-button').addEventListener('click', () => {
  scene.isolate();
  updateComponentPanel();
});
element('visibility-button').addEventListener('click', () => {
  scene.toggleVisibility();
  updateComponentPanel();
});
element('transparency-button').addEventListener('click', () => {
  scene.toggleTransparency();
  updateComponentPanel();
});
element('restore-button').addEventListener('click', () => {
  scene.restoreVisibility();
  updateComponentPanel();
});
element('model-url-button').addEventListener('click', () => {
  const url = element<HTMLInputElement>('model-url').value;
  void loadModel({ kind: 'url', url });
});
element('model-file').addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) void loadModel({ kind: 'file', file });
  input.value = '';
});
element('model-restore-button').addEventListener('click', () => {
  modelOperation += 1;
  const summary = scene.restoreProceduralModel();
  updateModelUi();
  const status = element('model-status');
  status.classList.remove('error');
  status.textContent = 'Procedural model active · no third-party asset loaded.';
  showToast(`Restored ${summary.label}`);
});
element('camera-button').addEventListener('click', () => {
  openDialog('settings-dialog');
  void populateCameras();
});
element('camera-start-button').addEventListener('click', () => void startCamera());
element('camera-stop-button').addEventListener('click', stopCamera);
element<HTMLInputElement>('mirror-checkbox').checked = camera.settings.mirror;
video.classList.toggle('mirrored', camera.settings.mirror);
overlayCanvas.classList.toggle('mirrored', camera.settings.mirror);
element('mirror-checkbox').addEventListener('change', (event) => {
  const mirror = (event.target as HTMLInputElement).checked;
  camera.setMirror(mirror);
  overlayCanvas.classList.toggle('mirrored', mirror);
});
element<HTMLSelectElement>('dominant-hand-select').value = calibration.dominantHand;
element('dominant-hand-select').addEventListener('change', (event) => {
  const dominantHand = (event.target as HTMLSelectElement).value as DominantHand;
  interaction.setDominantHand(dominantHand);
  calibration = { ...calibration, dominantHand };
  calibrationStore.save(calibration);
});
element('audio-checkbox').addEventListener('change', (event) =>
  audio.setMuted(!(event.target as HTMLInputElement).checked),
);
element('volume-input').addEventListener('input', (event) =>
  audio.setVolume(Number((event.target as HTMLInputElement).value)),
);
element('rebaseline-button').addEventListener('click', () => {
  interaction.depth.rebaseline();
  calibration = {
    ...calibration,
    neutralPalmScale: undefined,
    neutralPalmFeatures: undefined,
    calibratedAt: undefined,
  };
  calibrationStore.save(calibration);
  showToast('Relative Z baseline cleared. Hold one hand neutral and still.');
});
element('reset-calibration-button').addEventListener('click', () => {
  calibration = calibrationStore.reset();
  interaction.setDominantHand('auto');
  interaction.depth.rebaseline();
  element<HTMLSelectElement>('dominant-hand-select').value = 'auto';
  showToast('Saved calibration and onboarding state reset');
});
element('demo-button').addEventListener('click', () => (demo.running ? stopDemo() : startDemo()));
element('diagnostics-button').addEventListener('click', () => openDialog('diagnostics-dialog'));
element('help-button').addEventListener('click', () => openDialog('help-dialog'));
element('record-button').addEventListener('click', () => {
  if (benchmark.recording) benchmark.stop();
  else benchmark.start();
});
benchmark.addEventListener('change', () => {
  element('record-button').textContent = benchmark.recording ? 'Stop recording' : 'Start recording';
  element('benchmark-status').textContent = benchmark.recording
    ? `Recording · ${benchmark.count} samples`
    : `Recorder stopped · ${benchmark.count} samples`;
});
element('export-json-button').addEventListener('click', () => benchmark.download('json'));
element('export-csv-button').addEventListener('click', () => benchmark.download('csv'));

element('onboarding-back').addEventListener('click', () => {
  onboardingIndex = Math.max(0, onboardingIndex - 1);
  renderOnboarding();
});
element('onboarding-next').addEventListener('click', () => {
  if (onboardingIndex === onboardingSteps.length - 1) closeOnboarding(true);
  else {
    onboardingIndex += 1;
    renderOnboarding();
  }
});
element('onboarding-skip').addEventListener('click', () => closeOnboarding(true));
element('onboarding-skip-top').addEventListener('click', () => closeOnboarding(true));

window.addEventListener('keydown', (event) => {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLButtonElement ||
    (target instanceof HTMLElement && target.isContentEditable) ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  )
    return;
  const command = keyToCommand(event.key, event.shiftKey);
  if (!command) return;
  event.preventDefault();
  if (command.type === 'mode') {
    setVisualMode(command.mode);
    if (command.mode === 'diagnostic') openDialog('diagnostics-dialog');
  }
  if (command.type === 'explode') scene.toggleExploded();
  if (command.type === 'reset') {
    scene.reset();
    interaction.reset();
    audio.play('reset');
  }
  if (command.type === 'fullscreen')
    void document.documentElement.requestFullscreen().catch(() => undefined);
  if (command.type === 'help') openDialog('help-dialog');
});

setInterval(() => {
  const now = new Date();
  const clock = element<HTMLTimeElement>('mission-clock');
  clock.dateTime = now.toISOString();
  clock.textContent = now.toLocaleTimeString([], { hour12: false });
  const transform = scene.snapshot();
  element('axis-x').textContent = transform.x.toFixed(2);
  element('axis-y').textContent = transform.y.toFixed(2);
  element('axis-z').textContent = transform.z.toFixed(2);
  if (!latestUpdate?.depth.available)
    element('depth-value').textContent = `${transform.z >= 0 ? '+' : ''}${transform.z.toFixed(2)}`;

  const sample = telemetry.sample(performance.now(), selectedTelemetryChannel);
  element('telemetry-angle').textContent =
    `${sample.jointAngleDeg >= 0 ? '+' : ''}${sample.jointAngleDeg.toFixed(1)}°`;
  element('telemetry-torque').textContent = `${sample.torqueNm.toFixed(1)} N·m`;
  element('telemetry-temperature').textContent = `${sample.temperatureC.toFixed(1)} °C`;
  element('telemetry-current').textContent = `${sample.currentA.toFixed(2)} A`;
  element('telemetry-health').textContent = `${sample.healthPercent.toFixed(1)}%`;
  element('telemetry-cycle').textContent = String(sample.cycleCount).padStart(6, '0');
  element('telemetry-tool').textContent = sample.toolStatus;
  updateDiagnostics();
}, 250);

renderOnboarding();
const query = new URLSearchParams(location.search);
if (query.get('demo') === '1') startDemo();
else if (!calibration.onboardingComplete) openDialog('onboarding-dialog');

window.addEventListener('beforeunload', () => {
  demo.stop();
  tracker.dispose();
  camera.dispose();
  pointerInput.stop();
  audio.dispose();
  scene.dispose();
});
