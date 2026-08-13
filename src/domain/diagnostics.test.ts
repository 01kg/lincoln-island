import { describe, expect, it } from 'vitest';
import {
  diagnosticCamp,
  diagnosticMarkers,
  diagnosticPathDistances,
  formatDiagnosticKeys,
  getCardinalDirection,
  getInitialVisibilityCandidate,
  isInitialVisibilityCandidate,
} from './diagnostics';

describe('漫游诊断营地数据', () => {
  it('把三个颜色和形状不同的标记固定放在营地相对坐标中', () => {
    expect(diagnosticMarkers).toHaveLength(3);
    expect(diagnosticMarkers.map((marker) => marker.shape)).toEqual(['gate', 'column', 'beacon']);
    expect(diagnosticMarkers.map((marker) => marker.offset)).toEqual([[0, -8], [-4.5, -7], [4.5, -7]]);
    expect(diagnosticPathDistances).toEqual([1.8, 3.1, 4.5, 5.9, 7.2]);
  });

  it('证明白门、左右标记处于初始相机前方和视锥候选范围内', () => {
    const candidates = diagnosticMarkers.map((marker) =>
      getInitialVisibilityCandidate(marker.offset, marker.height / 2, diagnosticCamp),
    );
    expect(candidates.every(isInitialVisibilityCandidate)).toBe(true);
    expect(candidates.map((candidate) => candidate.forwardDistance)).toEqual([7, 6, 6]);
  });

  it('保证路径第一块在近裁面之外且位于前方', () => {
    const firstPathCandidate = getInitialVisibilityCandidate(
      [0, diagnosticCamp.spawnOffset[1] - diagnosticPathDistances[0]],
      0,
      diagnosticCamp,
    );
    expect(firstPathCandidate.isAhead).toBe(true);
    expect(firstPathCandidate.forwardDistance).toBeGreaterThan(0.1);
  });

  it('把相机 yaw 映射为稳定的原型方位读数', () => {
    expect(getCardinalDirection(0)).toBe('N');
    expect(getCardinalDirection(Math.PI / 2)).toBe('E');
    expect(getCardinalDirection(Math.PI)).toBe('S');
    expect(getCardinalDirection((Math.PI * 3) / 2)).toBe('W');
  });

  it('没有按键时明确显示无，而不是空白', () => {
    expect(formatDiagnosticKeys([])).toBe('无');
    expect(formatDiagnosticKeys(['W', 'A'])).toBe('W A');
  });
});
