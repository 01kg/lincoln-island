import { describe, expect, it } from 'vitest';
import { buildGreyboxSceneSpec } from './greybox';

describe('灰盒场景规格', () => {
  it('提供可漫游的地面和可辨认的占位地标', () => {
    const spec = buildGreyboxSceneSpec();

    expect(spec.ground.size).toBeGreaterThan(spec.landmark.size[0]);
    expect(spec.landmark.id).toBe('prototype-landmark');
    expect(spec.landmark.position[1]).toBe(spec.landmark.size[1] / 2);
    expect(spec.landmark.label).not.toHaveLength(0);
  });
});
