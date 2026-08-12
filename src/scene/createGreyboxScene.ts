import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import { buildGreyboxSceneSpec } from '../domain/greybox';

export interface BabylonSceneHandle {
  engine: Engine;
  scene: Scene;
}

export function createGreyboxScene(canvas: HTMLCanvasElement): BabylonSceneHandle {
  const spec = buildGreyboxSceneSpec();
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.04, 0.1, 0.16, 1);

  const camera = new ArcRotateCamera(
    'observer-camera',
    -Math.PI / 2,
    Math.PI / 3,
    18,
    new Vector3(0, 1, 0),
    scene,
  );
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 30;
  camera.attachControl(canvas, true);

  const light = new HemisphericLight('island-sun', new Vector3(0, 1, 0), scene);
  light.intensity = 0.9;

  const ground = MeshBuilder.CreateGround(
    'greybox-ground',
    { width: spec.ground.size, height: spec.ground.size },
    scene,
  );
  const groundMaterial = new StandardMaterial('greybox-ground-material', scene);
  groundMaterial.diffuseColor = new Color3(...spec.ground.color);
  ground.material = groundMaterial;

  const landmark = MeshBuilder.CreateBox(
    spec.landmark.id,
    {
      width: spec.landmark.size[0],
      height: spec.landmark.size[1],
      depth: spec.landmark.size[2],
    },
    scene,
  );
  landmark.position = new Vector3(...spec.landmark.position);
  const landmarkMaterial = new StandardMaterial(`${spec.landmark.id}-material`, scene);
  landmarkMaterial.diffuseColor = new Color3(...spec.landmark.color);
  landmark.material = landmarkMaterial;

  return { engine, scene };
}
