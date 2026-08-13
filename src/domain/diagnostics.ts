export type DiagnosticPosition = readonly [x: number, y: number, z: number];
export interface DiagnosticResetPose {
  readonly spawn: DiagnosticPosition;
  readonly target: DiagnosticPosition;
}
export type DiagnosticShape = 'gate' | 'column' | 'beacon';
export type CardinalDirection = 'N' | 'E' | 'S' | 'W';

export interface DiagnosticMarkerDefinition {
  readonly id: string;
  readonly label: string;
  /** Position relative to the diagnostic camp origin; never a literary location. */
  readonly offset: readonly [x: number, z: number];
  readonly height: number;
  readonly color: readonly [r: number, g: number, b: number];
  readonly shape: DiagnosticShape;
}

export interface DiagnosticCampDefinition {
  /** Prototype-only coordinates, intentionally independent from terrain sampling. */
  readonly origin: DiagnosticPosition;
  readonly platformWidth: number;
  readonly platformDepth: number;
  readonly platformHeight: number;
  readonly eyeHeight: number;
  readonly fieldOfViewRadians: number;
  readonly aspectRatio: number;
  /** Looking along negative z puts all references directly ahead. */
  readonly forward: readonly [x: number, z: number];
  /** Camera start relative to the camp centre, before any gravity settles it. */
  readonly spawnOffset: readonly [x: number, z: number];
  readonly gateTargetHeight: number;
}

/** Versioned gray-box camp; no position or label is a Lincoln Island fact. */
export const diagnosticCamp: DiagnosticCampDefinition = {
  origin: [10, 5.5, 6],
  platformWidth: 16,
  platformDepth: 18,
  platformHeight: 0.5,
  eyeHeight: 1.7,
  fieldOfViewRadians: Math.PI / 2.4,
  aspectRatio: 16 / 9,
  forward: [0, -1],
  spawnOffset: [0, -1],
  gateTargetHeight: 2.4,
};

export const diagnosticMarkers: readonly DiagnosticMarkerDefinition[] = [
  { id: 'white-gate', label: '前 · 白门', offset: [0, -8], height: 4.8, color: [1, 1, 0.92], shape: 'gate' },
  { id: 'red-column', label: '左 · 红柱', offset: [-4.5, -7], height: 5.4, color: [1, 0.08, 0.04], shape: 'column' },
  { id: 'yellow-beacon', label: '右 · 黄标', offset: [4.5, -7], height: 5.8, color: [1, 0.82, 0.03], shape: 'beacon' },
];

/** Distance from the camera spawn along forward; first tile clears the near plane. */
export const diagnosticPathDistances: readonly number[] = [1.8, 3.1, 4.5, 5.9, 7.2];

export function getDiagnosticResetPose(camp: DiagnosticCampDefinition = diagnosticCamp): DiagnosticResetPose {
  const spawn: DiagnosticPosition = [
    camp.origin[0] + camp.spawnOffset[0],
    camp.origin[1] + camp.platformHeight / 2 + camp.eyeHeight,
    camp.origin[2] + camp.spawnOffset[1],
  ];
  const target: DiagnosticPosition = [
    camp.origin[0] + camp.forward[0],
    camp.origin[1] + camp.gateTargetHeight,
    camp.origin[2] + camp.forward[1],
  ];

  return { spawn, target };
}

export interface VisibilityCandidate {
  readonly id: string;
  readonly forwardDistance: number;
  readonly horizontalRatio: number;
  readonly verticalRatio: number;
  readonly isAhead: boolean;
  readonly isInHorizontalFov: boolean;
  readonly isInVerticalFov: boolean;
}

/**
 * Tests a camp-relative point against a symmetric perspective frustum around
 * the fixed initial forward vector. It proves geometric visibility candidates,
 * not final GPU pixels or occlusion by arbitrary future assets.
 */
export function getInitialVisibilityCandidate(
  offset: readonly [x: number, z: number],
  targetHeight: number,
  camp: DiagnosticCampDefinition = diagnosticCamp,
): VisibilityCandidate {
  const [forwardX, forwardZ] = camp.forward;
  const relativeX = offset[0] - camp.spawnOffset[0];
  const relativeZ = offset[1] - camp.spawnOffset[1];
  const forwardDistance = relativeX * forwardX + relativeZ * forwardZ;
  const rightDistance = relativeX * -forwardZ + relativeZ * forwardX;
  const verticalDistance = targetHeight - camp.eyeHeight;
  const horizontalLimit = Math.tan(camp.fieldOfViewRadians / 2) * camp.aspectRatio;
  const verticalLimit = Math.tan(camp.fieldOfViewRadians / 2);
  const horizontalRatio = forwardDistance > 0 ? Math.abs(rightDistance / forwardDistance) : Infinity;
  const verticalRatio = forwardDistance > 0 ? Math.abs(verticalDistance / forwardDistance) : Infinity;

  return {
    id: `${offset[0]},${offset[1]}`,
    forwardDistance,
    horizontalRatio,
    verticalRatio,
    isAhead: forwardDistance > 0,
    isInHorizontalFov: forwardDistance > 0 && horizontalRatio <= horizontalLimit,
    isInVerticalFov: forwardDistance > 0 && verticalRatio <= verticalLimit,
  };
}

export function isInitialVisibilityCandidate(candidate: VisibilityCandidate): boolean {
  return candidate.isAhead && candidate.isInHorizontalFov && candidate.isInVerticalFov;
}

export function getCardinalDirection(yaw: number): CardinalDirection {
  const turns = ((yaw / (Math.PI * 2)) % 1 + 1) % 1;
  const index = Math.floor((turns + 0.125) * 4) % 4;
  return (['N', 'E', 'S', 'W'] as const)[index];
}

export function formatDiagnosticKeys(keys: readonly string[]): string {
  return keys.length === 0 ? '无' : keys.join(' ');
}
