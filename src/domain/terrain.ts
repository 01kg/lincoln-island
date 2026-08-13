export type Position3 = readonly [x: number, y: number, z: number];

export interface TerrainConfig {
  /** Prototype convention: one world unit is assumed to represent one metre. */
  readonly worldUnitMetres: 1;
  /** This is an experience-compression assumption, not a literary geography fact. */
  readonly compressionNote: 'prototype-compressed';
  readonly seed: number;
  readonly gridSize: number;
  readonly cellSize: number;
  readonly seaLevel: number;
  readonly islandRadiusX: number;
  readonly islandRadiusZ: number;
  readonly shorelineMargin: number;
  readonly maxStepHeight: number;
  readonly eyeHeight: number;
  readonly cameraRadius: number;
  /** Recovery guard only; Babylon remains responsible for ordinary gravity. */
  readonly maxCameraTerrainGap: number;
  readonly minCameraHeight: number;
}

export interface TerrainVertex {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface TerrainMeshData {
  readonly vertices: readonly TerrainVertex[];
  readonly indices: readonly number[];
  readonly bounds: {
    readonly minX: number;
    readonly maxX: number;
    readonly minZ: number;
    readonly maxZ: number;
  };
}

export const islandTerrainConfig: TerrainConfig = {
  worldUnitMetres: 1,
  compressionNote: 'prototype-compressed',
  seed: 1808,
  gridSize: 41,
  cellSize: 1.5,
  seaLevel: 0,
  islandRadiusX: 25,
  islandRadiusZ: 19,
  shorelineMargin: 0.08,
  maxStepHeight: 0.8,
  eyeHeight: 1.7,
  cameraRadius: 0.35,
  maxCameraTerrainGap: 2.5,
  minCameraHeight: 0.5,
};

function wave(value: number, seed: number): number {
  return Math.sin(value * 0.31 + seed * 0.017) * 0.5 + Math.sin(value * 0.13 - seed * 0.023) * 0.25;
}

function radialDistance(x: number, z: number, config: TerrainConfig): number {
  const angle = Math.atan2(z, x);
  const outline = 1 + 0.1 * Math.sin(angle * 3 + config.seed * 0.01) + 0.06 * Math.cos(angle * 5);
  return Math.sqrt((x / config.islandRadiusX) ** 2 + (z / config.islandRadiusZ) ** 2) / outline;
}

export function isLandAt(x: number, z: number, config: TerrainConfig = islandTerrainConfig): boolean {
  return radialDistance(x, z, config) <= 1 - config.shorelineMargin;
}

export function sampleTerrainHeight(x: number, z: number, config: TerrainConfig = islandTerrainConfig): number {
  const radius = radialDistance(x, z, config);
  if (radius > 1) {
    return config.seaLevel;
  }

  const landMass = Math.max(0, 1 - radius);
  const rollingHeight = 0.35 + 3.6 * landMass ** 0.68 + wave(x + z, config.seed) * 0.28;
  const mountain = 5.2 * Math.exp(-(((x + 7) ** 2) / 48 + ((z + 3) ** 2) / 38));
  return Math.max(config.seaLevel + 0.05, rollingHeight + mountain);
}

export function createTerrainMeshData(config: TerrainConfig = islandTerrainConfig): TerrainMeshData {
  const vertices: TerrainVertex[] = [];
  const indices: number[] = [];
  const halfExtent = (config.gridSize - 1) * config.cellSize * 0.5;
  const indexAt = (row: number, column: number) => row * config.gridSize + column;

  for (let row = 0; row < config.gridSize; row += 1) {
    for (let column = 0; column < config.gridSize; column += 1) {
      const x = column * config.cellSize - halfExtent;
      const z = row * config.cellSize - halfExtent;
      vertices.push({ x, y: sampleTerrainHeight(x, z, config), z });
    }
  }

  for (let row = 0; row < config.gridSize - 1; row += 1) {
    for (let column = 0; column < config.gridSize - 1; column += 1) {
      const x = column * config.cellSize - halfExtent + config.cellSize / 2;
      const z = row * config.cellSize - halfExtent + config.cellSize / 2;
      if (!isLandAt(x, z, config)) {
        continue;
      }
      const topLeft = indexAt(row, column);
      const topRight = indexAt(row, column + 1);
      const bottomLeft = indexAt(row + 1, column);
      const bottomRight = indexAt(row + 1, column + 1);
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  return {
    vertices,
    indices,
    bounds: {
      minX: -halfExtent,
      maxX: halfExtent,
      minZ: -halfExtent,
      maxZ: halfExtent,
    },
  };
}

export function getSafeSpawnPosition(config: TerrainConfig = islandTerrainConfig): Position3 {
  const x = 0;
  const z = 7;
  return [x, sampleTerrainHeight(x, z, config) + config.eyeHeight, z];
}

export function canOccupyPosition(
  current: Position3,
  desired: Position3,
  config: TerrainConfig = islandTerrainConfig,
): boolean {
  if (!isLandAt(desired[0], desired[2], config)) {
    return false;
  }
  const currentGround = current[1] - config.eyeHeight;
  const desiredGround = sampleTerrainHeight(desired[0], desired[2], config);
  return Math.abs(desiredGround - currentGround) <= config.maxStepHeight;
}

export function keepPositionOnLand(
  current: Position3,
  desired: Position3,
  config: TerrainConfig = islandTerrainConfig,
): Position3 {
  if (!canOccupyPosition(current, desired, config)) {
    return current;
  }
  return [desired[0], sampleTerrainHeight(desired[0], desired[2], config) + config.eyeHeight, desired[2]];
}

export function isPlayerPositionSafe(
  position: Position3,
  config: TerrainConfig = islandTerrainConfig,
): boolean {
  if (!isLandAt(position[0], position[2], config) || position[1] < config.minCameraHeight) {
    return false;
  }
  const expectedEyeHeight = sampleTerrainHeight(position[0], position[2], config) + config.eyeHeight;
  return Math.abs(position[1] - expectedEyeHeight) <= config.maxCameraTerrainGap;
}

/**
 * Babylon handles normal camera movement, gravity and mesh collisions. This
 * pure boundary rule only restores the last known safe position after a
 * camera clearly leaves the playable land/height envelope.
 */
export function resolvePlayerBoundaryPosition(
  position: Position3,
  lastSafePosition: Position3,
  config: TerrainConfig = islandTerrainConfig,
): Position3 {
  return isPlayerPositionSafe(position, config) ? position : lastSafePosition;
}
