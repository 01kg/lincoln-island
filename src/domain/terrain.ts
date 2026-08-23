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
  /** Global disaster threshold only; Babylon owns ordinary vertical motion. */
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

export interface PlayerMovementConfig {
  /**
   * Movement tuning is intentionally in domain config so frame tests can assert
   * explicit, versioned constants used by scene controls.
   */
  readonly walkSpeed: number;
  readonly gravityY: number;
  readonly inertia: number;
  readonly movementSettleMs: number;
  readonly recoveryCooldownMs: number;
  readonly movementLockMs: number;
  readonly jumpImpulse: number;
  readonly jumpCooldownMs: number;
  readonly jumpDurationMs: number;
  readonly offshoreSinkSpeed: number;
}

export interface PlayerRecoveryDecision {
  readonly shouldRecover: boolean;
  readonly reason: 'offshore' | 'fallen' | null;
  readonly nextRecoveryAt: number;
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
  minCameraHeight: 0.5,
};

export const playerMovementConfig: PlayerMovementConfig = {
  /**
   * Camera speed is scene-driven, approximately world unit per frame delta.
   * Current value is a child-friendly baseline for the compressed world.
   */
  walkSpeed: 3.2,
  gravityY: -0.18,
  inertia: 0.12,
  // Brief settle avoids immediate carry-over from key/recovery transitions.
  movementSettleMs: 220,
  recoveryCooldownMs: 420,
  movementLockMs: 220,
  jumpImpulse: 2.4,
  jumpCooldownMs: 380,
  jumpDurationMs: 520,
  // Clearly visible continuous sinking; recovery happens within a few seconds.
  offshoreSinkSpeed: 2.4,
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
  // Keep the island landform gently rolling. The nearby dramatic summit is a
  // separate, intentional gray-box landmark in the scene rather than a broad
  // green terrain bulge that reads as a paper-thin mountain.
  return Math.max(config.seaLevel + 0.05, rollingHeight);
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
      const topLeft = indexAt(row, column);
      const topRight = indexAt(row, column + 1);
      const bottomLeft = indexAt(row + 1, column);
      const bottomRight = indexAt(row + 1, column + 1);
      // A cell whose centre is on land can still have one or more corners in
      // the sea. Drawing it produced green triangular sheets under the water.
      // Keep only wholly terrestrial cells; the scene builds a cliff skirt
      // around the resulting coastline.
      const corners = [
        vertices[topLeft],
        vertices[topRight],
        vertices[bottomLeft],
        vertices[bottomRight],
      ];
      if (
        !isLandAt(x, z, config)
        || !corners.every((corner) => isLandAt(corner.x, corner.z, config))
        // Remove the nearly submerged fringe entirely. Those very shallow
        // top faces can otherwise be seen edge-on as floating green sheets.
        || !corners.every((corner) => corner.y > config.seaLevel + 0.35)
      ) {
        continue;
      }
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

export function isPlayerPositionSafe(position: Position3, config: TerrainConfig = islandTerrainConfig): boolean {
  // Babylon owns ordinary gravity and collision against the discrete terrain
  // mesh. Do not compare with the continuous height sampler here: their
  // surfaces are not guaranteed to match between grid vertices/triangles.
  return isLandAt(position[0], position[2], config) && position[1] >= config.minCameraHeight;
}

/**
 * Decide whether to trigger one-shot disaster recovery.
 * This does not override gravity/collision behavior each frame; it only decides
 * the moments where a recovery should happen for clearly invalid position states.
 */
export function decidePlayerRecovery(
  position: Position3,
  lastRecoveryAt: number,
  now: number,
  config: TerrainConfig = islandTerrainConfig,
  recoveryCooldownMs: number = playerMovementConfig.recoveryCooldownMs,
): PlayerRecoveryDecision {
  if (isPlayerPositionSafe(position, config)) {
    return {
      shouldRecover: false,
      reason: null,
      nextRecoveryAt: lastRecoveryAt,
    };
  }

  if (lastRecoveryAt > 0 && now - lastRecoveryAt < recoveryCooldownMs) {
    return {
      shouldRecover: false,
      reason: null,
      nextRecoveryAt: lastRecoveryAt,
    };
  }

  const reason = position[1] < config.minCameraHeight ? 'fallen' : 'offshore';
  return {
    shouldRecover: true,
    reason,
    nextRecoveryAt: now,
  };
}

/**
 * Babylon handles normal camera movement, gravity and mesh collisions. This
 * pure boundary rule only returns the last-known safe position on recovery.
 */
export function resolvePlayerBoundaryPosition(
  position: Position3,
  lastSafePosition: Position3,
  config: TerrainConfig = islandTerrainConfig,
): Position3 {
  return isPlayerPositionSafe(position, config) ? position : lastSafePosition;
}
