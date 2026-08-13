import { describe, expect, it } from 'vitest';
import { diagnosticMarkers, diagnosticPathMarkers, formatDiagnosticKeys, getCardinalDirection } from './diagnostics';

describe('漫游诊断灰盒数据', () => {
  it('提供三个有序、可区分的参照物与路径间隔', () => {
    expect(diagnosticMarkers).toHaveLength(3);
    expect(new Set(diagnosticMarkers.map((marker) => marker.id)).size).toBe(3);
    expect(diagnosticMarkers.map((marker) => marker.shape)).toEqual(['gate', 'column', 'beacon']);
    expect(diagnosticPathMarkers).toEqual([6, 4.5, 3, 1.5, 0, -1.5]);
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
