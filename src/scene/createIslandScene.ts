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
  type Position3,
} from '../domain/terrain';

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

export function createIslandScene(canvas: HTMLCanvasElement): BabylonSceneHandle {
  if (!Engine.IsSupported) {
    throw new Error('当前浏览器未提供可用的 WebGL。');
  }

  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.04, 0.1, 0.16, 1);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.16, 0);

  const spawn = getSafeSpawnPosition();
  const camera = new FreeCamera('island-observer', new Vector3(...spawn), scene);
  camera.attachControl(canvas, true);
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

  let lastSafePosition: Position3 = spawn;
  const keepCameraSafe = () => {
    const current: Position3 = [camera.position.x, camera.position.y, camera.position.z];
    const resolved = resolvePlayerBoundaryPosition(current, lastSafePosition);
    if (resolved !== current) {
      camera.position = new Vector3(...resolved);
      return;
    }
    lastSafePosition = current;
  };
  scene.onBeforeRenderObservable.add(keepCameraSafe);

  const enterLookMode = () => {
    if (document.pointerLockElement !== canvas) {
      void canvas.requestPointerLock?.();
    }
  };
  canvas.addEventListener('click', enterLookMode);

  const dispose = () => {
    canvas.removeEventListener('click', enterLookMode);
    scene.onBeforeRenderObservable.removeCallback(keepCameraSafe);
    scene.dispose();
    engine.dispose();
  };

  return { engine, scene, dispose };
}
