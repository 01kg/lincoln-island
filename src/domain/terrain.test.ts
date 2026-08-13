import { describe, expect, it } from 'vitest';
import {
  canOccupyPosition,
  createTerrainMeshData,
  getSafeSpawnPosition,
  islandTerrainConfig,
  isPlayerPositionSafe,
  isLandAt,
  keepPositionOnLand,
  resolvePlayerBoundaryPosition,
  sampleTerrainHeight,
} from './terrain';

describe('确定性岛屿地形', () => {
  it('同一输入会生成相同的网格和索引', () => {
    expect(createTerrainMeshData(islandTerrainConfig)).toEqual(createTerrainMeshData(islandTerrainConfig));
  });

  it('有海岸、岛内高地，并且不是方形平面', () => {
    const mesh = createTerrainMeshData(islandTerrainConfig);
    const heights = mesh.vertices.map((vertex) => vertex.y);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(Math.max(...heights)).toBeGreaterThan(Math.min(...heights));
    expect(isLandAt(0, 0)).toBe(true);
    expect(isLandAt(islandTerrainConfig.islandRadiusX * 1.1, 0)).toBe(false);
    expect(mesh.indices.length).toBeLessThan((islandTerrainConfig.gridSize - 1) ** 2 * 6);
  });
});

describe('玩家位置边界', () => {
  it('出生点在陆地上并保持眼睛高度', () => {
    const spawn = getSafeSpawnPosition();
    expect(isLandAt(spawn[0], spawn[2])).toBe(true);
    expect(spawn[1]).toBeCloseTo(sampleTerrainHeight(spawn[0], spawn[2]) + islandTerrainConfig.eyeHeight);
  });

  it('拒绝走入海中，并将可行走位置贴回地面高度', () => {
    const current = getSafeSpawnPosition();
    const sea = [islandTerrainConfig.islandRadiusX * 1.2, current[1], current[2]] as const;
    expect(canOccupyPosition(current, sea)).toBe(false);
    expect(keepPositionOnLand(current, sea)).toEqual(current);

    const nearby = [current[0] + 1, current[1], current[2]] as const;
    const resolved = keepPositionOnLand(current, nearby);
    expect(resolved[0]).toBe(nearby[0]);
    expect(resolved[1]).toBeCloseTo(sampleTerrainHeight(resolved[0], resolved[2]) + islandTerrainConfig.eyeHeight);
  });

  it('只在明显脱离水平或垂直安全范围时恢复上一个安全位置', () => {
    const safe = getSafeSpawnPosition();
    const nearby = [safe[0] + 1, safe[1], safe[2]] as const;
    expect(isPlayerPositionSafe(nearby)).toBe(true);
    expect(resolvePlayerBoundaryPosition(nearby, safe)).toEqual(nearby);

    const fallen = [safe[0], -1, safe[2]] as const;
    expect(isPlayerPositionSafe(fallen)).toBe(false);
    expect(resolvePlayerBoundaryPosition(fallen, safe)).toEqual(safe);
  });
});
