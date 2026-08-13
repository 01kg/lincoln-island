// Babylon's collision coordinator is a required side effect for camera
// collisions when using modular imports.
import '@babylonjs/core/Collisions/collisionCoordinator';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Scene } from '@babylonjs/core/scene';
import {
  createTerrainMeshData,
  getSafeSpawnPosition,
  islandTerrainConfig,
  resolvePlayerBoundaryPosition,
  sampleTerrainHeight,
  type Position3,
} from '../domain/terrain';
import { keyboardMovementBindings } from '../domain/playerInput';
import {
  diagnosticMarkers,
  diagnosticPathMarkers,
  formatDiagnosticKeys,
  getCardinalDirection,
} from '../domain/diagnostics';

export interface SceneDiagnostics {
  readonly position: Position3;
  readonly yaw: number;
  readonly heading: ReturnType<typeof getCardinalDirection>;
  readonly keys: string;
  readonly pointerLocked: boolean;
}

export interface BabylonSceneHandle {
  engine: Engine;
  scene: Scene;
  dispose: () => void;
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
  material.diffuseColor = new Color3(0.2, 0.42, 0.27);
  material.specularColor = new Color3(0.04, 0.06, 0.04);
  terrain.material = material;
  terrain.checkCollisions = true;
}

function createSea(scene: Scene): void {
  const sea = MeshBuilder.CreateGround('sea', { width: 100, height: 100 }, scene);
  const material = new StandardMaterial('sea-material', scene);
  material.diffuseColor = new Color3(0.04, 0.25, 0.38);
  material.specularColor = new Color3(0.12, 0.3, 0.4);
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
  material.diffuseColor = new Color3(0.76, 0.55, 0.24);
  marker.material = material;
}

function createDiagnosticMaterial(scene: Scene, name: string, color: readonly [number, number, number]): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = new Color3(...color);
  material.emissiveColor = new Color3(...color).scale(0.18);
  return material;
}

function createDiagnosticReferences(scene: Scene): void {
  for (const marker of diagnosticMarkers) {
    const y = sampleTerrainHeight(marker.x, marker.z) + marker.height / 2 + 0.08;
    const material = createDiagnosticMaterial(scene, `diagnostic-${marker.id}`, marker.color);
    if (marker.shape === 'gate') {
      const postOptions = { width: 0.22, height: marker.height, depth: 0.22 };
      const left = MeshBuilder.CreateBox(`${marker.id}-left`, postOptions, scene);
      const right = MeshBuilder.CreateBox(`${marker.id}-right`, postOptions, scene);
      const top = MeshBuilder.CreateBox(`${marker.id}-top`, { width: 2, height: 0.22, depth: 0.22 }, scene);
      left.position = new Vector3(marker.x - 0.9, y, marker.z);
      right.position = new Vector3(marker.x + 0.9, y, marker.z);
      top.position = new Vector3(marker.x, y + marker.height / 2, marker.z);
      left.material = material;
      right.material = material;
      top.material = material;
    } else if (marker.shape === 'column') {
      const column = MeshBuilder.CreateCylinder(`${marker.id}-mesh`, { diameter: 0.8, height: marker.height, tessellation: 6 }, scene);
      column.position = new Vector3(marker.x, y, marker.z);
      column.material = material;
    } else {
      const beacon = MeshBuilder.CreateBox(`${marker.id}-mesh`, { width: 1, height: marker.height, depth: 1 }, scene);
      beacon.position = new Vector3(marker.x, y, marker.z);
      beacon.rotation.y = Math.PI / 4;
      beacon.material = material;
    }
  }

  const pathMaterial = createDiagnosticMaterial(scene, 'diagnostic-path-material', [0.68, 0.72, 0.72]);
  diagnosticPathMarkers.forEach((z, index) => {
    const tile = MeshBuilder.CreateBox(`diagnostic-path-${index}`, { width: 2, height: 0.08, depth: 0.55 }, scene);
    tile.position = new Vector3(0, sampleTerrainHeight(0, z) + 0.06, z);
    tile.material = pathMaterial;
  });
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
  // Keep the gray-box land, sea, and sky visibly distinct before formal art.
  scene.clearColor = new Color4(0.1, 0.16, 0.22, 1);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.16, 0);

  const spawn = getSafeSpawnPosition();
  const camera = new FreeCamera('island-observer', new Vector3(...spawn), scene);
  // Spawn at z=7 and look toward the near gate/path at z=2 so land and
  // diagnostic references are in the initial view rather than behind the eye.
  camera.setTarget(new Vector3(0, sampleTerrainHeight(0, 2) + islandTerrainConfig.eyeHeight * 0.7, 2));
  camera.attachControl(canvas, true);
  canvas.tabIndex = 0;
  camera.keysUp = [...keyboardMovementBindings.forward];
  camera.keysDown = [...keyboardMovementBindings.backward];
  camera.keysLeft = [...keyboardMovementBindings.left];
  camera.keysRight = [...keyboardMovementBindings.right];
  camera.speed = 0.16;
  camera.inertia = 0.3;
  camera.angularSensibility = 3500;
  camera.checkCollisions = true;
  camera.applyGravity = true;
  camera.ellipsoid = new Vector3(
    islandTerrainConfig.cameraRadius,
    0.9,
    islandTerrainConfig.cameraRadius,
  );
  // Camera position is the eye; offset the collision ellipsoid down to put its
  // body center below the eye while Babylon applies ordinary gravity/collisions.
  camera.ellipsoidOffset = new Vector3(0, -0.8, 0);
  camera.minZ = 0.1;

  const light = new HemisphericLight('island-sun', new Vector3(0.2, 1, 0.15), scene);
  light.intensity = 0.9;

  createSea(scene);
  createTerrainMesh(scene);
  createHighlandMarker(scene);
  createDiagnosticReferences(scene);

  let lastSafePosition: Position3 = spawn;
  let wasUnsafe = false;
  const activeKeys = new Set<string>();
  const keyLabels = new Map<string, string>([
    ['KeyW', 'W'], ['KeyA', 'A'], ['KeyS', 'S'], ['KeyD', 'D'],
    ['ArrowUp', '↑'], ['ArrowLeft', '←'], ['ArrowDown', '↓'], ['ArrowRight', '→'],
  ]);
  const handleKeyDown = (event: KeyboardEvent) => {
    if (keyLabels.has(event.code)) activeKeys.add(event.code);
  };
  const handleKeyUp = (event: KeyboardEvent) => activeKeys.delete(event.code);
  const emitDiagnostics = () => {
    if (!onDiagnostics) return;
    const yaw = camera.rotation.y;
    onDiagnostics({
      position: [camera.position.x, camera.position.y, camera.position.z],
      yaw,
      heading: getCardinalDirection(yaw),
      keys: formatDiagnosticKeys([...activeKeys].map((code) => keyLabels.get(code) ?? code)),
      pointerLocked: document.pointerLockElement === canvas,
    });
  };
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  let lastDiagnosticsAt = -Infinity;
  const emitThrottledDiagnostics = () => {
    const now = performance.now();
    if (now - lastDiagnosticsAt >= 100) {
      lastDiagnosticsAt = now;
      emitDiagnostics();
    }
  };
  const keepCameraSafe = () => {
    const current: Position3 = [camera.position.x, camera.position.y, camera.position.z];
    const resolved = resolvePlayerBoundaryPosition(current, lastSafePosition);
    if (resolved !== current) {
      if (!wasUnsafe) {
        // Recover once on the safe -> unsafe transition. Keep rotation and
        // clear only pending translation so input can continue immediately.
        camera.position = new Vector3(...resolved);
        camera.cameraDirection.copyFromFloats(0, 0, 0);
        wasUnsafe = true;
      }
      // Keep the HUD honest even during a recovery: a received key must be
      // visible when position is held at the last safe point.
      emitThrottledDiagnostics();
      return;
    }
    lastSafePosition = current;
    wasUnsafe = false;
    emitThrottledDiagnostics();
  };
  scene.onBeforeRenderObservable.add(keepCameraSafe);

  const enterLookMode = () => {
    canvas.focus({ preventScroll: true });
    if (document.pointerLockElement !== canvas) {
      const request = canvas.requestPointerLock?.();
      if (request instanceof Promise) {
        void request.catch(() => {
          // Pointer Lock can be denied by browser policy; Babylon still keeps
          // its press-and-drag fallback for ordinary mouse movement.
        });
      }
    }
  };
  // Request from pointerdown while the browser still has a direct user gesture.
  canvas.addEventListener('pointerdown', enterLookMode);
  emitDiagnostics();

  const dispose = () => {
    canvas.removeEventListener('pointerdown', enterLookMode);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    scene.onBeforeRenderObservable.removeCallback(keepCameraSafe);
    scene.dispose();
    engine.dispose();
  };

  return { engine, scene, dispose };
}
