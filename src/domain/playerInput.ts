export interface KeyboardMovementBindings {
  readonly forward: readonly number[];
  readonly backward: readonly number[];
  readonly left: readonly number[];
  readonly right: readonly number[];
}

export const keyboardMovementBindings: KeyboardMovementBindings = {
  forward: [87, 38],
  backward: [83, 40],
  left: [65, 37],
  right: [68, 39],
};

export function flattenKeyboardBindings(bindings: KeyboardMovementBindings): number[] {
  return [...bindings.forward, ...bindings.backward, ...bindings.left, ...bindings.right];
}

export function hasUniqueKeyboardBindings(bindings: KeyboardMovementBindings): boolean {
  const keys = flattenKeyboardBindings(bindings);
  return new Set(keys).size === keys.length;
}
