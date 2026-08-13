// Required side effects for modular Babylon imports: camera collisions and
// StandardMaterial's default shader sources.
import '@babylonjs/core/Collisions/collisionCoordinator';
import '@babylonjs/core/Engines/engine.common';
import '@babylonjs/core/Engines/shaderStore';
import '@babylonjs/core/Shaders/default.fragment';
import '@babylonjs/core/Shaders/default.vertex';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import '@babylonjs/core/Cameras/freeCameraInputsManager';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Scene } from '@babylonjs/core/scene';
import {
  createTerrainMeshData,
  decidePlayerRecovery,
  isLandAt,
  islandTerrainConfig,
  playerMovementConfig,
  type Position3,
} from '../domain/terrain';
import { keyboardMovementBindings } from '../domain/playerInput';
import {
  diagnosticCamp,
  diagnosticMarkers,
  diagnosticPathDistances,
  formatDiagnosticKeys,
  getCardinalDirection,
  getDiagnosticResetPose,
  getInitialVisibilityCandidate,
  isInitialVisibilityCandidate,
} from '../domain/diagnostics';

type RecoveryCauseLabel = 'manual-reset' | 'offshore' | 'fallen' | 'none';

export interface SceneDiagnostics {
  readonly position: Position3;
  readonly yaw: number;
  readonly heading: ReturnType<typeof getCardinalDirection>;
  readonly keys: string;
  readonly pointerLocked: boolean;
  readonly movementSpeed: number;
  readonly camp: '营地' | '营地外陆地' | '海上';
  readonly recovery: '无' | '离岸复位' | '掉落复位' | '手动复位';
  readonly distanceFromCamp: number;
  /** Geometric candidates + active/ready status, not a claim about GPU pixels. */
  readonly references: string;
  readonly sceneStatus: '运行中' | `失败：${string}`;
}

export interface BabylonSceneHandle {
  engine: Engine;
  scene: Scene;
  dispose: () => void;
}

interface DiagnosticReferenceAssembly {
  readonly markerMeshes: readonly Mesh[];
  readonly pathMeshes: readonly Mesh[];
  readonly candidateCount: number;
}

function createTerrainMesh(scene: Scene): void {
  const data = createTerrainMeshData(islandTerrainConfig);
  const positions = data.vertices.flatMap((vertex) => [vertex.x, vertex.y, vertex.z]);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, [...data.indices], normals);

  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = [...data.indices];
  vertexData.normals = normals;
  const terrain = MeshBuilder.CreateGround('island-terrain', { width: 1, height: 1 }, scene);
  vertexData.applyToMesh(terrain);

  const material = new StandardMaterial('island-terrain-material', scene);
  material.diffuseColor = new Color3(0.34, 0.57, 0.22);
  material.ambientColor = new Color3(0.16, 0.22, 0.11);
  material.specularColor = Color3.Black();
  terrain.material = material;
  terrain.checkCollisions = true;
}

function createSea(scene: Scene): void {
  const sea = MeshBuilder.CreateGround('sea', { width: 100, height: 100 }, scene);
  const material = new StandardMaterial('sea-material', scene);
  material.diffuseColor = new Color3(0.08, 0.42, 0.67);
  material.emissiveColor = new Color3(0.015, 0.07, 0.12);
  material.specularColor = new Color3(0.25, 0.4, 0.52);
  sea.material = material;
}

function createHighlandMarker(scene: Scene): void {
  const marker = MeshBuilder.CreateCylinder(
    'highland-marker',
    { diameter: 2.4, height: 0.6, tessellation: 6 },
    scene,
  );
  marker.position = new Vector3(-7, 6.6, -3);
  const material = new StandardMaterial('highland-marker-material', scene);
  material.diffuseColor = new Color3(0.86, 0.62, 0.18);
  material.emissiveColor = new Color3(0.18, 0.12, 0.02);
  marker.material = material;
  marker.checkCollisions = false;
}

function createFlatMaterial(scene: Scene, name: string, color: readonly [number, number, number]): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  const visibleColor = new Color3(...color);
  material.disableLighting = true;
  material.diffuseColor = visibleColor;
  material.emissiveColor = visibleColor;
  material.specularColor = Color3.Black();
  return material;
}

function campWorldPosition(offset: readonly [x: number, z: number], heightAbovePlatform = 0): Vector3 {
  return new Vector3(
    diagnosticCamp.origin[0] + offset[0],
    diagnosticCamp.origin[1] + diagnosticCamp.platformHeight / 2 + heightAbovePlatform,
    diagnosticCamp.origin[2] + offset[1],
  );
}

function createDiagnosticCamp(scene: Scene): DiagnosticReferenceAssembly {
  const [campX, campY, campZ] = diagnosticCamp.origin;
  const platform = MeshBuilder.CreateBox(
    'diagnostic-camp-platform',
    {
      width: diagnosticCamp.platformWidth,
      height: diagnosticCamp.platformHeight,
      depth: diagnosticCamp.platformDepth,
    },
    scene,
  );
  platform.position = new Vector3(campX, campY, campZ);
  platform.material = createFlatMaterial(scene, 'diagnostic-camp-platform-material', [0.82, 0.77, 0.61]);
  platform.checkCollisions = true;

  const markerMeshes: Mesh[] = [];
  for (const marker of diagnosticMarkers) {
    const material = createFlatMaterial(scene, `diagnostic-${marker.id}-material`, marker.color);
    if (marker.shape === 'gate') {
      const postOptions = { width: 0.5, height: marker.height, depth: 0.5 };
      const left = MeshBuilder.CreateBox(`${marker.id}-left`, postOptions, scene);
      const right = MeshBuilder.CreateBox(`${marker.id}-right`, postOptions, scene);
      const top = MeshBuilder.CreateBox(`${marker.id}-top`, { width: 4.2, height: 0.5, depth: 0.5 }, scene);
      left.position = campWorldPosition([marker.offset[0] - 1.85, marker.offset[1]], marker.height / 2);
      right.position = campWorldPosition([marker.offset[0] + 1.85, marker.offset[1]], marker.height / 2);
      top.position = campWorldPosition(marker.offset, marker.height);
      for (const mesh of [left, right, top]) {
        mesh.material = material;
        mesh.checkCollisions = true;
        markerMeshes.push(mesh);
      }
    } else if (marker.shape === 'column') {
      const column = MeshBuilder.CreateCylinder(
        `${marker.id}-mesh`,
        { diameter: 1.25, height: marker.height, tessellation: 8 },
        scene,
      );
      column.position = campWorldPosition(marker.offset, marker.height / 2);
      column.material = material;
      column.checkCollisions = true;
      markerMeshes.push(column);
    } else {
      const beacon = MeshBuilder.CreateBox(
        `${marker.id}-mesh`,
        { width: 1.5, height: marker.height, depth: 1.5 },
        scene,
      );
      beacon.position = campWorldPosition(marker.offset, marker.height / 2);
      beacon.rotation.y = Math.PI / 4;
      beacon.material = material;
      beacon.checkCollisions = true;
      markerMeshes.push(beacon);
    }
  }

  const pathMaterial = createFlatMaterial(scene, 'diagnostic-path-material', [0.98, 0.98, 0.98]);
  const pathMeshes = diagnosticPathDistances.map((distance, index) => {
    const scale = 1.3 - index * 0.12;
    const tile = MeshBuilder.CreateBox(
      `diagnostic-path-${index}`,
      { width: 3.2 * scale, height: 0.12, depth: 0.72 * scale },
      scene,
    );
    tile.position = campWorldPosition(
      [diagnosticCamp.spawnOffset[0], diagnosticCamp.spawnOffset[1] - distance],
      0.12,
    );
    tile.material = pathMaterial;
    return tile;
  });

  const candidateCount = diagnosticMarkers
    .map((marker) => getInitialVisibilityCandidate(marker.offset, marker.height / 2))
    .filter(isInitialVisibilityCandidate)
    .length;
  return { markerMeshes, pathMeshes, candidateCount };
}

function getCampStatus(position: Position3): SceneDiagnostics['camp'] {
  const [campX, campY, campZ] = diagnosticCamp.origin;
  const onPlatform = Math.abs(position[0] - campX) <= diagnosticCamp.platformWidth / 2
    && Math.abs(position[2] - campZ) <= diagnosticCamp.platformDepth / 2
    && position[1] >= campY;
  if (onPlatform) return '营地';
  return isLandAt(position[0], position[2]) ? '营地外陆地' : '海上';
}

function buildRecoveryText(recovery: RecoveryCauseLabel): '无' | '离岸复位' | '掉落复位' | '手动复位' {
  if (recovery === 'manual-reset') return '手动复位';
  if (recovery === 'offshore') return '离岸复位';
  if (recovery === 'fallen') return '掉落复位';
  return '无';
}

export function createIslandScene(
  canvas: HTMLCanvasElement,
  onDiagnostics?: (diagnostics: SceneDiagnostics) => void,
): BabylonSceneHandle {
  if (!Engine.IsSupported) {
    throw new Error('当前浏览器未提供可用的 WebGL。');
  }

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.46, 0.73, 0.93, 1);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, playerMovementConfig.gravityY, 0);

  createSea(scene);
  createTerrainMesh(scene);
  createHighlandMarker(scene);
  const diagnosticCampAssembly = createDiagnosticCamp(scene);

  const spawnPose = getDiagnosticResetPose(diagnosticCamp);
  const spawn: Position3 = spawnPose.spawn;
  const diagnosticTarget: Position3 = spawnPose.target;
  let lastRecoveryAt = 0;
  let movementLockUntil = 0;
  let recoveryShowUntil = 0;
  let settleUntil = 0;
  let recoveryCause: RecoveryCauseLabel = 'none';

  const camera = new FreeCamera('island-observer', new Vector3(...spawn), scene);
  const activeKeys = new Set<string>();
  const keyLabels = new Map<string, string>([
    ['KeyW', 'W'],
    ['KeyA', 'A'],
    ['KeyS', 'S'],
    ['KeyD', 'D'],
    ['ArrowUp', '↑'],
    ['ArrowLeft', '←'],
    ['ArrowDown', '↓'],
    ['ArrowRight', '→'],
  ]);

  const clearMomentum = () => {
    camera.cameraDirection.copyFromFloats(0, 0, 0);
  };

  const lockMovement = () => {
    movementLockUntil = performance.now() + playerMovementConfig.movementLockMs;
    camera.speed = 0;
    clearMomentum();
  };

  const unlockMovement = () => {
    camera.speed = playerMovementConfig.walkSpeed;
    recoveryCause = 'none';
  };

  const beginRecovery = (cause: RecoveryCauseLabel) => {
    recoveryCause = cause;
    recoveryShowUntil = performance.now() + 700;
    settleUntil = performance.now() + playerMovementConfig.movementSettleMs;
    lockMovement();
  };

  const updateRecoveryState = (now: number) => {
    if (now >= movementLockUntil) {
      if (camera.speed === 0) {
        unlockMovement();
      }
    }
    camera.applyGravity = now >= settleUntil;
    if (now < settleUntil) {
      clearMomentum();
    }
    if (recoveryCause !== 'none' && now >= recoveryShowUntil) {
      recoveryCause = 'none';
    }
  };

  const resetToDiagnosticCamp = (clearManualKeys = true) => {
    camera.position.copyFromFloats(...spawn);
    const [targetX, targetY, targetZ] = diagnosticTarget;
    camera.setTarget(new Vector3(targetX, targetY, targetZ));
    clearMomentum();
    lastRecoveryAt = -1;
    beginRecovery('manual-reset');
    camera.applyGravity = true;
    if (clearManualKeys) {
      activeKeys.clear();
    }
  };

  camera.attachControl(canvas, true);
  canvas.tabIndex = 0;
  camera.keysUp = [...keyboardMovementBindings.forward];
  camera.keysDown = [...keyboardMovementBindings.backward];
  camera.keysLeft = [...keyboardMovementBindings.left];
  camera.keysRight = [...keyboardMovementBindings.right];
  // Babylon FreeCamera speed and inertia are scene-driven movement primitives.
  // Keep these constants in domain config for deterministic verification.
  camera.speed = playerMovementConfig.walkSpeed;
  camera.inertia = playerMovementConfig.inertia;
  camera.angularSensibility = 3500;
  camera.checkCollisions = true;
  camera.applyGravity = true;
  camera.ellipsoid = new Vector3(islandTerrainConfig.cameraRadius, 0.9, islandTerrainConfig.cameraRadius);
  camera.ellipsoidOffset = new Vector3(0, -0.82, 0);
  camera.minZ = 0.1;
  camera.fov = diagnosticCamp.fieldOfViewRadians;
  // Face marker direction immediately after attach; initial scene orientation remains deterministic.
  const [targetX, targetY, targetZ] = diagnosticTarget;
  camera.setTarget(new Vector3(targetX, targetY, targetZ));
  camera.rotation.y = Math.atan2(diagnosticCamp.forward[0], diagnosticCamp.forward[1]);

  const light = new HemisphericLight('island-sun', new Vector3(0.2, 1, 0.15), scene);
  light.intensity = 1.15;
  light.groundColor = new Color3(0.38, 0.48, 0.38);

  const getReferenceStatus = () => {
    const meshes = [...diagnosticCampAssembly.markerMeshes, ...diagnosticCampAssembly.pathMeshes];
    const active = meshes.filter((mesh) => mesh.isEnabled() && mesh.isVisible).length;
    const ready = meshes.filter((mesh) => mesh.isReady()).length;
    return `候选 ${diagnosticCampAssembly.candidateCount}/3 · 网格 ${active}/${meshes.length} active · ${ready}/${meshes.length} ready`;
  };

  const emitDiagnostics = () => {
    if (!onDiagnostics) return;
    const position: Position3 = [camera.position.x, camera.position.y, camera.position.z];
    const yaw = camera.rotation.y;
    const horizontalDistance = Math.hypot(
      position[0] - diagnosticCamp.origin[0],
      position[2] - diagnosticCamp.origin[2],
    );
    onDiagnostics({
      position,
      yaw,
      heading: getCardinalDirection(yaw),
      movementSpeed: playerMovementConfig.walkSpeed,
      keys: formatDiagnosticKeys([...activeKeys].map((code) => keyLabels.get(code) ?? code)),
      pointerLocked: document.pointerLockElement === canvas,
      camp: getCampStatus(position),
      recovery: buildRecoveryText(recoveryCause),
      distanceFromCamp: horizontalDistance,
      references: getReferenceStatus(),
      sceneStatus: '运行中',
    });
  };

  let lastDiagnosticsAt = -Infinity;
  const emitThrottledDiagnostics = () => {
    const now = performance.now();
    if (now - lastDiagnosticsAt < 100) {
      return;
    }
    lastDiagnosticsAt = now;
    emitDiagnostics();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'KeyR' && !event.repeat) {
      resetToDiagnosticCamp();
      return;
    }
    if (keyLabels.has(event.code)) {
      activeKeys.add(event.code);
    }
  };
  const handleKeyUp = (event: KeyboardEvent) => {
    activeKeys.delete(event.code);
  };

  const keepCameraSafe = () => {
    const now = performance.now();
    const current: Position3 = [camera.position.x, camera.position.y, camera.position.z];
    updateRecoveryState(now);
    const isMovementLocked = now < movementLockUntil;

    const decision = decidePlayerRecovery(current, lastRecoveryAt, now, islandTerrainConfig, playerMovementConfig.recoveryCooldownMs);
    if (decision.shouldRecover) {
      const recoverTo = spawn;
      camera.position.copyFromFloats(...recoverTo);
      const [targetX, targetY, targetZ] = diagnosticTarget;
      camera.setTarget(new Vector3(targetX, targetY, targetZ));
      lastRecoveryAt = decision.nextRecoveryAt;
      beginRecovery(decision.reason ?? 'offshore');
      emitThrottledDiagnostics();
      return;
    }

    if (isLandAt(current[0], current[2])) {
      // keep as runtime-safe state implicitly; explicit snap is avoided to preserve normal
      // Babylon collision response.
    }

    if (isMovementLocked) {
      clearMomentum();
    }
    emitThrottledDiagnostics();
  };

  scene.onBeforeRenderObservable.add(keepCameraSafe);

  const enterLookMode = () => {
    canvas.focus({ preventScroll: true });
    if (document.pointerLockElement !== canvas) {
      const request = canvas.requestPointerLock?.();
      if (request instanceof Promise) {
        void request.catch(() => {
          // Pointer Lock can be denied by browser policy; Babylon keeps
          // drag fallback for ordinary mouse movement.
        });
      }
    }
  };
  canvas.addEventListener('pointerdown', enterLookMode);

  const handlePointerLockChange = () => {
    emitDiagnostics();
  };
  document.addEventListener('pointerlockchange', handlePointerLockChange);

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  resetToDiagnosticCamp();
  emitDiagnostics();

  const dispose = () => {
    canvas.removeEventListener('pointerdown', enterLookMode);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    document.removeEventListener('pointerlockchange', handlePointerLockChange);
    scene.onBeforeRenderObservable.removeCallback(keepCameraSafe);
    scene.dispose();
    engine.dispose();
  };

  return { engine, scene, dispose };
}
