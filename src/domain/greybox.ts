export type Position3 = readonly [x: number, y: number, z: number];

export interface GreyboxSceneSpec {
  ground: {
    size: number;
    color: readonly [r: number, g: number, b: number];
  };
  landmark: {
    id: string;
    label: string;
    position: Position3;
    size: Position3;
    color: readonly [r: number, g: number, b: number];
  };
}

/**
 * The first scene is intentionally data-shaped so a later chapter resolver can
 * replace it without making Babylon.js the source of world facts.
 */
export function buildGreyboxSceneSpec(): GreyboxSceneSpec {
  return {
    ground: {
      size: 32,
      color: [0.22, 0.38, 0.3],
    },
    landmark: {
      id: 'prototype-landmark',
      label: '灰盒地标',
      position: [0, 1.5, 0],
      size: [3, 3, 3],
      color: [0.82, 0.58, 0.28],
    },
  };
}
