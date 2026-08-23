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
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Scene } from '@babylonjs/core/scene';
import {
  createTerrainMeshData,
  decidePlayerRecovery,
  isLandAt,
  sampleTerrainHeight,
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

type RecoveryCauseLabel = 'manual-reset' | 'sinking' | 'offshore' | 'fallen' | 'portal' | 'pickup' | 'hurt' | 'enemy-defeated' | 'player-defeated' | 'reload' | 'empty' | 'none';

const magazineCapacity = 12;
const reserveAmmoCapacity = 48;
const enemyFallDurationMs = 520;
const enemyCorpseLifetimeMs = 3200;

const seaHighland = {
  centerX: -7,
  centerZ: -3,
  baseY: -3.4,
  height: 12,
  topRadius: 2.5,
  baseRadius: 12,
} as const;

export interface SceneDiagnostics {
  readonly position: Position3;
  readonly yaw: number;
  readonly heading: ReturnType<typeof getCardinalDirection>;
  readonly keys: string;
  readonly pointerLocked: boolean;
  readonly movementSpeed: number;
  readonly camp: '营地' | '营地外陆地' | '海上';
  readonly recovery: '无' | '海中下沉' | '离岸复位' | '掉落复位' | '手动复位' | '山顶传送' | '获得枪' | '受伤' | '击败敌人' | '生命耗尽' | '换弹' | '弹匣空';
  readonly motion: '待命' | '跳跃中' | '海中下沉' | '开火中';
  readonly hasGun: boolean;
  readonly shotsFired: number;
  readonly ammoInMagazine: number;
  readonly reserveAmmo: number;
  readonly playerHealth: number;
  readonly enemiesRemaining: number;
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

interface GunPickupAssembly {
  readonly meshes: readonly Mesh[];
  readonly groundPosition: Vector3;
}

interface EnemyState {
  readonly root: TransformNode;
  readonly meshes: readonly Mesh[];
  readonly targetPosition: Vector3;
  readonly groundPosition: Vector3;
  readonly wanderPhaseOffset: number;
  readonly maxHealth: number;
  health: number;
  deathStartedAt: number | null;
}

function createTerrainMesh(scene: Scene): Mesh {
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
  // The prototype's visible land surface is the source of the residual green
  // curved strips around the sea-emerging landmark. Keep it as collision
  // geometry for walking, but leave the visual ground to the camp and landmark
  // meshes so no stray green surface remains on screen.
  terrain.isVisible = false;
  return terrain;
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
    {
      diameterTop: seaHighland.topRadius * 2,
      diameterBottom: seaHighland.baseRadius * 2,
      height: seaHighland.height,
      tessellation: 7,
      subdivisions: 4,
    },
    scene,
  );
  // Deliberately begin beneath the sea plane so this landmark reads as a
  // mountain emerging from the water, not as an object placed on grass.
  marker.position = new Vector3(
    seaHighland.centerX,
    seaHighland.baseY + seaHighland.height / 2,
    seaHighland.centerZ,
  );
  const material = new StandardMaterial('highland-marker-material', scene);
  material.diffuseColor = new Color3(0.2, 0.5, 0.16);
  material.ambientColor = new Color3(0.1, 0.25, 0.08);
  material.specularColor = Color3.Black();
  marker.material = material;
  marker.checkCollisions = true;
}

function highlandHorizontalDistance(x: number, z: number): number {
  return Math.hypot(x - seaHighland.centerX, z - seaHighland.centerZ);
}

function highlandSurfaceHeight(x: number, z: number): number {
  const distance = highlandHorizontalDistance(x, z);
  if (distance <= seaHighland.topRadius) {
    return seaHighland.baseY + seaHighland.height;
  }
  if (distance >= seaHighland.baseRadius) {
    return seaHighland.baseY;
  }
  const slopeProgress = (distance - seaHighland.topRadius)
    / (seaHighland.baseRadius - seaHighland.topRadius);
  return seaHighland.baseY + seaHighland.height * (1 - slopeProgress);
}

function isHighlandAreaAt(x: number, z: number): boolean {
  return highlandHorizontalDistance(x, z) <= seaHighland.baseRadius + 0.35;
}

function createGunPickup(scene: Scene): GunPickupAssembly {
  const groundPosition = new Vector3(
    seaHighland.centerX + 1.7,
    highlandSurfaceHeight(seaHighland.centerX + 1.7, seaHighland.centerZ),
    seaHighland.centerZ,
  );
  const bodyMaterial = createFlatMaterial(scene, 'mountain-gun-body-material', [0.16, 0.18, 0.22]);
  const metalMaterial = createFlatMaterial(scene, 'mountain-gun-metal-material', [0.52, 0.56, 0.6]);
  const gripMaterial = createFlatMaterial(scene, 'mountain-gun-grip-material', [0.08, 0.06, 0.04]);

  const body = MeshBuilder.CreateBox('mountain-gun-body', { width: 0.55, height: 0.34, depth: 1.3 }, scene);
  body.position = groundPosition.add(new Vector3(0, 0.55, 0));
  body.material = bodyMaterial;

  const barrel = MeshBuilder.CreateBox('mountain-gun-barrel', { width: 0.2, height: 0.18, depth: 0.85 }, scene);
  barrel.position = groundPosition.add(new Vector3(0, 0.57, -1.02));
  barrel.material = metalMaterial;

  const grip = MeshBuilder.CreateBox('mountain-gun-grip', { width: 0.28, height: 0.72, depth: 0.42 }, scene);
  grip.position = groundPosition.add(new Vector3(0, 0.18, 0.34));
  grip.rotation.z = -0.28;
  grip.material = gripMaterial;

  const sight = MeshBuilder.CreateBox('mountain-gun-sight', { width: 0.12, height: 0.2, depth: 0.22 }, scene);
  sight.position = groundPosition.add(new Vector3(0, 0.78, -0.18));
  sight.material = metalMaterial;

  return { meshes: [body, barrel, grip, sight], groundPosition };
}

function createEnemies(scene: Scene): EnemyState[] {
  const bodyMaterial = createFlatMaterial(scene, 'enemy-body-material', [0.72, 0.08, 0.05]);
  const headMaterial = createFlatMaterial(scene, 'enemy-head-material', [0.82, 0.42, 0.2]);
  const limbMaterial = createFlatMaterial(scene, 'enemy-limb-material', [0.16, 0.18, 0.22]);
  const faceMaterial = createFlatMaterial(scene, 'enemy-face-material', [0.02, 0.02, 0.02]);
  const enemyOffsets: readonly [number, number][] = [
    [-6, -5], [-2, -5], [2, -5], [6, -5],
    [-6, -1.5], [-2, -1.5], [2, -1.5], [6, -1.5],
    [-4, 3], [4, 3],
  ];
  const platformTopY = diagnosticCamp.origin[1] + diagnosticCamp.platformHeight / 2;
  return enemyOffsets.map(([offsetX, offsetZ], index) => {
    const groundPosition = new Vector3(
      diagnosticCamp.origin[0] + offsetX,
      platformTopY,
      diagnosticCamp.origin[2] + offsetZ,
    );
    const root = new TransformNode(`enemy-${index + 1}-root`, scene);
    root.position.copyFrom(groundPosition);
    const torso = MeshBuilder.CreateBox(
      `enemy-${index + 1}-torso`,
      { width: 0.85, height: 1.25, depth: 0.52 },
      scene,
    );
    torso.position = new Vector3(0, 1.55, 0);
    torso.material = bodyMaterial;

    const head = MeshBuilder.CreateSphere(
      `enemy-${index + 1}-head`,
      { diameter: 0.62, segments: 8 },
      scene,
    );
    head.position = new Vector3(0, 2.48, 0);
    head.material = headMaterial;

    const leftEye = MeshBuilder.CreateSphere(
      `enemy-${index + 1}-left-eye`,
      { diameter: 0.12, segments: 6 },
      scene,
    );
    leftEye.position = new Vector3(-0.13, 2.52, 0.29);
    leftEye.material = faceMaterial;

    const rightEye = MeshBuilder.CreateSphere(
      `enemy-${index + 1}-right-eye`,
      { diameter: 0.12, segments: 6 },
      scene,
    );
    rightEye.position = new Vector3(0.13, 2.52, 0.29);
    rightEye.material = faceMaterial;

    const leftBrow = MeshBuilder.CreateBox(
      `enemy-${index + 1}-left-brow`,
      { width: 0.22, height: 0.045, depth: 0.05 },
      scene,
    );
    leftBrow.position = new Vector3(-0.13, 2.67, 0.29);
    leftBrow.rotation.z = -0.24;
    leftBrow.material = faceMaterial;

    const rightBrow = MeshBuilder.CreateBox(
      `enemy-${index + 1}-right-brow`,
      { width: 0.22, height: 0.045, depth: 0.05 },
      scene,
    );
    rightBrow.position = new Vector3(0.13, 2.67, 0.29);
    rightBrow.rotation.z = 0.24;
    rightBrow.material = faceMaterial;

    const mouth = MeshBuilder.CreateBox(
      `enemy-${index + 1}-mouth`,
      { width: 0.28, height: 0.06, depth: 0.05 },
      scene,
    );
    mouth.position = new Vector3(0, 2.31, 0.29);
    mouth.rotation.z = Math.PI;
    mouth.material = faceMaterial;

    const leftArm = MeshBuilder.CreateBox(
      `enemy-${index + 1}-left-arm`,
      { width: 0.24, height: 1.05, depth: 0.3 },
      scene,
    );
    leftArm.position = new Vector3(-0.58, 1.55, 0);
    leftArm.rotation.z = -0.08;
    leftArm.material = limbMaterial;

    const rightArm = MeshBuilder.CreateBox(
      `enemy-${index + 1}-right-arm`,
      { width: 0.24, height: 1.05, depth: 0.3 },
      scene,
    );
    rightArm.position = new Vector3(0.58, 1.55, 0);
    rightArm.rotation.z = 0.08;
    rightArm.material = limbMaterial;

    const leftLeg = MeshBuilder.CreateBox(
      `enemy-${index + 1}-left-leg`,
      { width: 0.3, height: 1.05, depth: 0.36 },
      scene,
    );
    leftLeg.position = new Vector3(-0.22, 0.55, 0);
    leftLeg.material = limbMaterial;

    const rightLeg = MeshBuilder.CreateBox(
      `enemy-${index + 1}-right-leg`,
      { width: 0.3, height: 1.05, depth: 0.36 },
      scene,
    );
    rightLeg.position = new Vector3(0.22, 0.55, 0);
    rightLeg.material = limbMaterial;

    const meshes = [torso, head, leftEye, rightEye, leftBrow, rightBrow, mouth, leftArm, rightArm, leftLeg, rightLeg];
    for (const mesh of meshes) {
      mesh.parent = root;
      mesh.isPickable = false;
      mesh.checkCollisions = false;
    }
    return {
      root,
      meshes,
      targetPosition: groundPosition.add(new Vector3(0, 1.55, 0)),
      groundPosition,
      wanderPhaseOffset: index * 0.73,
      maxHealth: 100,
      health: 100,
      deathStartedAt: null,
    };
  });
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
      const portalMaterial = new StandardMaterial(`${marker.id}-surface-material`, scene);
      portalMaterial.disableLighting = true;
      portalMaterial.diffuseColor = new Color3(0.12, 0.42, 0.95);
      portalMaterial.emissiveColor = new Color3(0.08, 0.28, 0.85);
      portalMaterial.specularColor = Color3.Black();
      portalMaterial.alpha = 0.78;
      portalMaterial.backFaceCulling = false;
      const portalSurface = MeshBuilder.CreatePlane(
        `${marker.id}-surface`,
        { width: 3.2, height: marker.height - 0.35 },
        scene,
      );
      portalSurface.position = campWorldPosition(marker.offset, (marker.height + 0.35) / 2);
      portalSurface.position.z -= 0.28;
      portalSurface.material = portalMaterial;
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

function buildRecoveryText(recovery: RecoveryCauseLabel): SceneDiagnostics['recovery'] {
  if (recovery === 'manual-reset') return '手动复位';
  if (recovery === 'sinking') return '海中下沉';
  if (recovery === 'offshore') return '离岸复位';
  if (recovery === 'fallen') return '掉落复位';
  if (recovery === 'portal') return '山顶传送';
  if (recovery === 'pickup') return '获得枪';
  if (recovery === 'hurt') return '受伤';
  if (recovery === 'enemy-defeated') return '击败敌人';
  if (recovery === 'player-defeated') return '生命耗尽';
  if (recovery === 'reload') return '换弹';
  if (recovery === 'empty') return '弹匣空';
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
  const gunPickup = createGunPickup(scene);
  const enemies = createEnemies(scene);
  const diagnosticCampAssembly = createDiagnosticCamp(scene);

  const spawnPose = getDiagnosticResetPose(diagnosticCamp);
  const spawn: Position3 = spawnPose.spawn;
  const diagnosticTarget: Position3 = spawnPose.target;
  let lastRecoveryAt = 0;
  let movementLockUntil = 0;
  let recoveryShowUntil = 0;
  let settleUntil = 0;
  let recoveryCause: RecoveryCauseLabel = 'none';
  let isSinkingInSea = false;
  let holdGravityAtReset = false;
  let jumpStartedAt: number | null = null;
  let jumpBaseY = 0;
  let nextJumpAt = 0;
  let nextPortalAt = 0;
  let hasGun = false;
  let shotsFired = 0;
  let nextShotAt = 0;
  let firingUntil = 0;
  let playerHealth = 100;
  let nextDamageAt = 0;
  let ammoInMagazine = magazineCapacity;
  let reserveAmmo = reserveAmmoCapacity;
  let enemiesWandering = false;
  let enemiesWanderStartedAt: number | null = null;

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
    ['Space', '空格'],
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
    camera.applyGravity = !holdGravityAtReset && now >= settleUntil && jumpStartedAt === null;
    if (now < settleUntil) {
      clearMomentum();
    }
    if (recoveryCause !== 'none' && now >= recoveryShowUntil) {
      recoveryCause = 'none';
    }
  };

  const resetToDiagnosticCamp = (clearManualKeys = true) => {
    camera.position.copyFromFloats(...spawn);
    const [targetX, , targetZ] = diagnosticTarget;
    camera.setTarget(new Vector3(targetX, spawn[1], targetZ));
    clearMomentum();
    lastRecoveryAt = -1;
    beginRecovery('manual-reset');
    // Start exactly at the platform-supported height. Do not let the settle
    // timer turn gravity back on while the player is still idle; that creates
    // the visual "crouch, then stand up" motion at game start and after R.
    holdGravityAtReset = true;
    camera.applyGravity = false;
    isSinkingInSea = false;
    jumpStartedAt = null;
    hasGun = false;
    shotsFired = 0;
    nextShotAt = 0;
    firingUntil = 0;
    playerHealth = 100;
    nextDamageAt = 0;
    ammoInMagazine = magazineCapacity;
    reserveAmmo = reserveAmmoCapacity;
    enemiesWandering = false;
    enemiesWanderStartedAt = null;
    for (const enemy of enemies) {
      enemy.health = enemy.maxHealth;
      enemy.deathStartedAt = null;
      enemy.root.rotation.copyFromFloats(0, 0, 0);
      enemy.root.position.copyFrom(enemy.groundPosition);
      enemy.root.setEnabled(true);
      for (const mesh of enemy.meshes) {
        mesh.setEnabled(true);
      }
    }
    for (const mesh of gunPickup.meshes) {
      mesh.setEnabled(true);
    }
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
  // FreeCamera defaults this to false, which means gravity only advances while
  // a movement key supplies cameraDirection. It is the direct cause of the
  // reported "falling stops when I release the key" behaviour.
  camera.needMoveForGravity = true;
  camera.ellipsoid = new Vector3(islandTerrainConfig.cameraRadius, 0.9, islandTerrainConfig.cameraRadius);
  camera.ellipsoidOffset = new Vector3(0, -0.82, 0);
  camera.minZ = 0.1;
  camera.fov = diagnosticCamp.fieldOfViewRadians;
  // Face marker direction immediately after attach; initial scene orientation remains deterministic.
  const [targetX, , targetZ] = diagnosticTarget;
  camera.setTarget(new Vector3(targetX, spawn[1], targetZ));
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
    const now = performance.now();
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
      motion: isSinkingInSea ? '海中下沉' : jumpStartedAt !== null ? '跳跃中' : now < firingUntil ? '开火中' : '待命',
      hasGun,
      shotsFired,
      ammoInMagazine,
      reserveAmmo,
      playerHealth,
      enemiesRemaining: enemies.filter((enemy) => enemy.health > 0).length,
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

  const jump = () => {
    if (performance.now() < nextJumpAt) {
      return;
    }
    const now = performance.now();
    const isMovementLocked = now < movementLockUntil;
    if (isMovementLocked || jumpStartedAt !== null || isSinkingInSea || !isLandAt(camera.position.x, camera.position.z)) {
      return;
    }
    // Own the short vertical arc explicitly. FreeCamera collision coordinates
    // are offset from its visible position, which made its vertical impulse
    // unreliable on the raised diagnostic platform.
    jumpBaseY = camera.position.y;
    jumpStartedAt = now;
    holdGravityAtReset = false;
    camera.applyGravity = false;
    camera.cameraDirection.y = 0;
    nextJumpAt = now + playerMovementConfig.jumpCooldownMs;
  };

  const portalGateX = diagnosticCamp.origin[0];
  const portalGateZ = diagnosticCamp.origin[2] - 8;
  const portalDestinationY = highlandSurfaceHeight(seaHighland.centerX, seaHighland.centerZ)
    + diagnosticCamp.collisionEyeHeight;

  const tryUseMountainPortal = (now: number): boolean => {
    if (now < nextPortalAt) return false;
    const nearPortal = Math.abs(camera.position.x - portalGateX) <= 1.65
      && Math.abs(camera.position.z - portalGateZ) <= 1.1
      && camera.position.y >= diagnosticCamp.origin[1]
      && camera.position.y <= diagnosticCamp.origin[1] + diagnosticCamp.platformHeight / 2 + 5.1;
    if (!nearPortal) return false;

    camera.position.copyFromFloats(seaHighland.centerX, portalDestinationY, seaHighland.centerZ);
    camera.setTarget(new Vector3(seaHighland.centerX, portalDestinationY, seaHighland.centerZ - 1));
    clearMomentum();
    camera.cameraDirection.y = 0;
    camera.applyGravity = false;
    holdGravityAtReset = true;
    isSinkingInSea = false;
    jumpStartedAt = null;
    enemiesWandering = true;
    enemiesWanderStartedAt = now;
    lastRecoveryAt = now;
    nextPortalAt = now + 1200;
    beginRecovery('portal');
    return true;
  };

  const collectGunIfNear = (now: number) => {
    if (hasGun) return;
    const horizontalDistance = Math.hypot(
      camera.position.x - gunPickup.groundPosition.x,
      camera.position.z - gunPickup.groundPosition.z,
    );
    const heightAboveGun = camera.position.y - gunPickup.groundPosition.y;
    if (horizontalDistance > 1.25 || heightAboveGun < 1 || heightAboveGun > 4) return;

    hasGun = true;
    for (const mesh of gunPickup.meshes) {
      mesh.setEnabled(false);
    }
    recoveryCause = 'pickup';
    recoveryShowUntil = now + 1200;
  };

  const reloadGun = (now: number) => {
    if (ammoInMagazine >= magazineCapacity || reserveAmmo <= 0) return;
    const needed = magazineCapacity - ammoInMagazine;
    const loaded = Math.min(needed, reserveAmmo);
    ammoInMagazine += loaded;
    reserveAmmo -= loaded;
    nextShotAt = now + 450;
    recoveryCause = 'reload';
    recoveryShowUntil = now + 700;
    emitDiagnostics();
  };

  const fireGun = () => {
    const now = performance.now();
    if (!hasGun || isSinkingInSea || now < nextShotAt) return;

    const direction = camera.getDirection(Vector3.Forward()).normalize();
    // The requested reload gesture: aim clearly upward and click. A normal
    // horizontal/downward click always remains a shot.
    if (direction.y >= 0.62) {
      reloadGun(now);
      return;
    }
    if (ammoInMagazine <= 0) {
      recoveryCause = 'empty';
      recoveryShowUntil = now + 700;
      emitDiagnostics();
      return;
    }
    ammoInMagazine -= 1;
    const start = camera.position.add(direction.scale(0.8));
    const end = camera.position.add(direction.scale(80));
    const tracer = MeshBuilder.CreateLines(`mountain-gun-shot-${shotsFired + 1}`, {
      points: [start, end],
      colors: [new Color4(1, 0.78, 0.16, 1), new Color4(1, 0.2, 0.03, 0.15)],
    }, scene);
    tracer.isPickable = false;

    const muzzleFlash = MeshBuilder.CreateSphere(
      `mountain-gun-muzzle-${shotsFired + 1}`,
      { diameter: 0.24, segments: 8 },
      scene,
    );
    muzzleFlash.position = start;
    muzzleFlash.material = createFlatMaterial(scene, `mountain-gun-muzzle-material-${shotsFired + 1}`, [1, 0.68, 0.08]);
    muzzleFlash.isPickable = false;

    let closestEnemy: EnemyState | null = null;
    let closestEnemyDistance = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      if (enemy.health <= 0) continue;
      const relative = enemy.targetPosition.subtract(start);
      const forwardDistance = Vector3.Dot(relative, direction);
      if (forwardDistance <= 0 || forwardDistance > 80) continue;
      const distanceFromRay = relative.subtract(direction.scale(forwardDistance)).length();
      if (distanceFromRay <= 0.78 && forwardDistance < closestEnemyDistance) {
        closestEnemy = enemy;
        closestEnemyDistance = forwardDistance;
      }
    }
    if (closestEnemy) {
      closestEnemy.health = Math.max(0, closestEnemy.health - 34);
      if (closestEnemy.health === 0) {
        closestEnemy.deathStartedAt = now;
        recoveryCause = 'enemy-defeated';
        recoveryShowUntil = now + 1200;
      }
    }

    shotsFired += 1;
    firingUntil = now + 180;
    nextShotAt = now + 260;
    emitDiagnostics();
    window.setTimeout(() => {
      tracer.dispose();
      muzzleFlash.material?.dispose();
      muzzleFlash.dispose();
    }, 120);
  };

  const updateEnemyDeaths = (now: number) => {
    for (const enemy of enemies) {
      if (enemy.health > 0 || enemy.deathStartedAt === null) continue;
      const elapsed = now - enemy.deathStartedAt;
      if (elapsed >= enemyFallDurationMs + enemyCorpseLifetimeMs) {
        enemy.root.setEnabled(false);
        enemy.deathStartedAt = null;
        continue;
      }
      const fallProgress = Math.min(1, elapsed / enemyFallDurationMs);
      const easedFall = 1 - (1 - fallProgress) ** 3;
      enemy.root.rotation.z = -Math.PI / 2 * easedFall;
    }
  };

  const updateEnemyWander = (now: number) => {
    if (!enemiesWandering || enemiesWanderStartedAt === null) return;
    const elapsedSeconds = (now - enemiesWanderStartedAt) / 1000;
    for (const enemy of enemies) {
      if (enemy.health <= 0 || enemy.deathStartedAt !== null) continue;

      // Each enemy follows a small, deterministic loop around its original
      // camp position. The subtraction keeps the first frame at the spawn
      // point, avoiding a visible snap when the portal is activated.
      const phase = elapsedSeconds * 0.7 + enemy.wanderPhaseOffset;
      const startPhase = enemy.wanderPhaseOffset;
      const nextX = enemy.groundPosition.x + (Math.sin(phase) - Math.sin(startPhase)) * 1.05;
      const nextZ = enemy.groundPosition.z + (Math.cos(phase * 0.82) - Math.cos(startPhase * 0.82)) * 0.85;
      const deltaX = nextX - enemy.root.position.x;
      const deltaZ = nextZ - enemy.root.position.z;
      enemy.root.position.x = nextX;
      enemy.root.position.z = nextZ;
      if (Math.hypot(deltaX, deltaZ) > 0.001) {
        enemy.root.rotation.y = Math.atan2(deltaX, deltaZ);
      }
      enemy.targetPosition.copyFromFloats(nextX, enemy.root.position.y + 1.55, nextZ);
    }
  };

  const applyEnemyContactDamage = (now: number): boolean => {
    if (now < nextDamageAt) return false;
    const touchingEnemy = enemies.some((enemy) => {
      if (enemy.health <= 0) return false;
      const horizontalDistance = Math.hypot(
        camera.position.x - enemy.root.position.x,
        camera.position.z - enemy.root.position.z,
      );
      const heightAboveEnemy = camera.position.y - enemy.root.position.y;
      return horizontalDistance <= 1.7 && heightAboveEnemy >= 1 && heightAboveEnemy <= 4;
    });
    if (!touchingEnemy) return false;

    playerHealth = Math.max(0, playerHealth - 20);
    nextDamageAt = now + 850;
    recoveryCause = 'hurt';
    recoveryShowUntil = now + 650;
    if (playerHealth === 0) {
      resetToDiagnosticCamp();
      beginRecovery('player-defeated');
      return true;
    }
    return false;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const isSpace = event.code === 'Space' || event.code === 'Spacebar' || event.key === ' ';
    if (isSpace && !event.repeat) {
      event.preventDefault();
      jump();
    }
    if (event.code === 'KeyR' && !event.repeat) {
      resetToDiagnosticCamp();
      return;
    }
    if (keyLabels.has(event.code)) {
      holdGravityAtReset = false;
      camera.applyGravity = true;
      activeKeys.add(event.code);
    }
  };
  const handleKeyUp = (event: KeyboardEvent) => {
    activeKeys.delete(event.code);
  };
  const handleMouseDown = (event: MouseEvent) => {
    if (event.button === 0 && event.target === canvas) {
      fireGun();
    }
  };

  const keepCameraSafe = () => {
    const now = performance.now();
    updateRecoveryState(now);
    updateEnemyDeaths(now);
    updateEnemyWander(now);

    if (jumpStartedAt !== null) {
      const progress = (now - jumpStartedAt) / playerMovementConfig.jumpDurationMs;
      if (progress >= 1) {
        camera.position.y = jumpBaseY;
        jumpStartedAt = null;
        camera.applyGravity = now >= settleUntil;
      } else {
        camera.cameraDirection.y = 0;
        camera.applyGravity = false;
        // A single, clearly visible CS-style hop: rise and return to the same
        // collision-supported height in just over half a second.
        camera.position.y = jumpBaseY + playerMovementConfig.jumpImpulse * 4 * progress * (1 - progress);
      }
    }

    const current: Position3 = [camera.position.x, camera.position.y, camera.position.z];
    const isMovementLocked = now < movementLockUntil;
    const isUnderwater = current[1] < islandTerrainConfig.seaLevel + 0.15;
    const onHighland = isHighlandAreaAt(current[0], current[2]) && current[1] > islandTerrainConfig.seaLevel;
    const inSea = (!isLandAt(current[0], current[2]) && !onHighland) || (isUnderwater && !onHighland);
    const frameSeconds = scene.getEngine().getDeltaTime() / 1000;

    if (tryUseMountainPortal(now)) {
      emitThrottledDiagnostics();
      return;
    }

    collectGunIfNear(now);

    if (inSea) {
      isSinkingInSea = true;
      jumpStartedAt = null;
      recoveryCause = 'sinking';
      recoveryShowUntil = now + 700;
      camera.cameraDirection.x = 0;
      camera.cameraDirection.z = 0;
      camera.applyGravity = false;
      camera.position.y -= playerMovementConfig.offshoreSinkSpeed * frameSeconds;
      if (camera.position.y <= islandTerrainConfig.minCameraHeight) {
        const recoverTo = spawn;
        camera.position.copyFromFloats(...recoverTo);
        const [targetX, , targetZ] = diagnosticTarget;
        camera.setTarget(new Vector3(targetX, spawn[1], targetZ));
        lastRecoveryAt = now;
        camera.applyGravity = true;
        beginRecovery('offshore');
        isSinkingInSea = false;
        jumpStartedAt = null;
        emitThrottledDiagnostics();
        return;
      }
      emitThrottledDiagnostics();
      return;
    }

    if (isSinkingInSea) {
      isSinkingInSea = false;
      camera.applyGravity = true;
    }

    if (onHighland) {
      // Treat the visible cone as a real walkable island extension. This also
      // protects against the custom sea boundary rule outranking its mesh
      // collider when the player is on a slope outside the original island.
      const highlandSupportY = highlandSurfaceHeight(current[0], current[2])
        + diagnosticCamp.collisionEyeHeight;
      if (camera.position.y < highlandSupportY) {
        camera.position.y = highlandSupportY;
        camera.cameraDirection.y = 0;
      }
    }

    if (applyEnemyContactDamage(now)) {
      emitThrottledDiagnostics();
      return;
    }

    const decision = decidePlayerRecovery(current, lastRecoveryAt, now, islandTerrainConfig, playerMovementConfig.recoveryCooldownMs);
    if (decision.shouldRecover && decision.reason === 'fallen') {
      const recoverTo = spawn;
      camera.position.copyFromFloats(...recoverTo);
      const [targetX, , targetZ] = diagnosticTarget;
      camera.setTarget(new Vector3(targetX, spawn[1], targetZ));
      lastRecoveryAt = decision.nextRecoveryAt;
      beginRecovery('fallen');
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

  // FreeCamera applies keyboard input before it renders. Running this safety
  // step immediately before that render makes sinking frame-driven, so it
  // cannot be paused or resumed by a movement key.
  const safetyObserver = scene.onBeforeCameraRenderObservable.add((activeCamera) => {
    if (activeCamera === camera) {
      keepCameraSafe();
    }
  });

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

  // Capture phase remains active while Pointer Lock is in use and runs before
  // any browser/Babylon handler can consume Space.
  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('mousedown', handleMouseDown, true);

  resetToDiagnosticCamp();
  emitDiagnostics();

  const dispose = () => {
    canvas.removeEventListener('pointerdown', enterLookMode);
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('keyup', handleKeyUp, true);
    window.removeEventListener('mousedown', handleMouseDown, true);
    document.removeEventListener('pointerlockchange', handlePointerLockChange);
    scene.onBeforeCameraRenderObservable.remove(safetyObserver);
    scene.dispose();
    engine.dispose();
  };

  return { engine, scene, dispose };
}
