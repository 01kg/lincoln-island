export type DiagnosticPosition = readonly [x: number, y: number, z: number];
export type DiagnosticShape = 'gate' | 'column' | 'beacon';
export type CardinalDirection = 'N' | 'E' | 'S' | 'W';

export interface DiagnosticMarkerDefinition {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly z: number;
  readonly height: number;
  readonly color: readonly [r: number, g: number, b: number];
  readonly shape: DiagnosticShape;
}

/** Versioned gray-box references; coordinates are prototype-only, not island facts. */
export const diagnosticMarkers: readonly DiagnosticMarkerDefinition[] = [
  { id: 'near-gate', label: '近 · 白门', x: 0, z: 5, height: 2.4, color: [0.92, 0.92, 0.84], shape: 'gate' },
  { id: 'left-column', label: '左 · 红柱', x: -3, z: 2, height: 3.2, color: [0.78, 0.18, 0.16], shape: 'column' },
  { id: 'right-beacon', label: '右 · 黄标', x: 3, z: -1, height: 4.2, color: [0.95, 0.68, 0.12], shape: 'beacon' },
];

export const diagnosticPathMarkers: readonly number[] = [6, 4.5, 3, 1.5, 0, -1.5];

export function getCardinalDirection(yaw: number): CardinalDirection {
  const turns = ((yaw / (Math.PI * 2)) % 1 + 1) % 1;
  const index = Math.floor((turns + 0.125) * 4) % 4;
  return (['N', 'E', 'S', 'W'] as const)[index];
}

export function formatDiagnosticKeys(keys: readonly string[]): string {
  return keys.length === 0 ? '无' : keys.join(' ');
}
