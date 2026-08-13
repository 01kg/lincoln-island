import { describe, expect, it } from 'vitest';
import { flattenKeyboardBindings, hasUniqueKeyboardBindings, keyboardMovementBindings } from './playerInput';

describe('第一人称键位映射', () => {
  it('显式覆盖 WASD 与方向键且没有重复键码', () => {
    expect(keyboardMovementBindings).toEqual({
      forward: [87, 38],
      backward: [83, 40],
      left: [65, 37],
      right: [68, 39],
    });
    expect(hasUniqueKeyboardBindings(keyboardMovementBindings)).toBe(true);
    expect(flattenKeyboardBindings(keyboardMovementBindings)).toHaveLength(8);
  });
});
