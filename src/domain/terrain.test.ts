import { describe, expect, it } from 'vitest';
import {
  canOccupyPosition,
  decidePlayerRecovery,
  createTerrainMeshData,
  getSafeSpawnPosition,
  islandTerrainConfig,
  playerMovementConfig,
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
  it('同一位置的非法越界仅触发一次恢复（遵循冷却窗口）', () => {
    const safe = getSafeSpawnPosition();
    const offshore = [islandTerrainConfig.islandRadiusX * 1.2, safe[1], safe[2]] as const;
    const start = performance.now();
    const first = decidePlayerRecovery(offshore, 0, start, islandTerrainConfig, 300);
    expect(first.shouldRecover).toBe(true);
    const tooSoon = decidePlayerRecovery(offshore, start, start + 80, islandTerrainConfig, 300);
    expect(tooSoon.shouldRecover).toBe(false);
  });

  it('掉落恢复和离岸恢复原因可区分', () => {
    const safe = getSafeSpawnPosition();
    const now = 0;
    const fallen = [safe[0], -2, safe[2]] as const;
    const decision = decidePlayerRecovery(fallen, -1, now, islandTerrainConfig, playerMovementConfig.recoveryCooldownMs);
    expect(decision.shouldRecover).toBe(true);
    expect(decision.reason).toBe('fallen');

    const offshore = [islandTerrainConfig.islandRadiusX * 1.1, safe[1], safe[2]] as const;
    const coastDecision = decidePlayerRecovery(offshore, -1, now, islandTerrainConfig, playerMovementConfig.recoveryCooldownMs);
    expect(coastDecision.shouldRecover).toBe(true);
    expect(coastDecision.reason).toBe('offshore');
  });

  it('离岸后在冷却期内仅恢复一次，冷却后可再次恢复', () => {
    const safe = getSafeSpawnPosition();
    const offshore = [islandTerrainConfig.islandRadiusX * 1.2, safe[1], safe[2]] as const;
    const start = 1_000;
    const first = decidePlayerRecovery(offshore, 0, start, islandTerrainConfig, playerMovementConfig.recoveryCooldownMs);
    expect(first.shouldRecover).toBe(true);
    const immediate = decidePlayerRecovery(offshore, start, start + 200, islandTerrainConfig, playerMovementConfig.recoveryCooldownMs);
    expect(immediate.shouldRecover).toBe(false);
    const afterCooldown = decidePlayerRecovery(offshore, start, start + 600, islandTerrainConfig, playerMovementConfig.recoveryCooldownMs);
    expect(afterCooldown.shouldRecover).toBe(true);
  });

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

  it('不因连续高度差拒绝陆地位置，只在海中或全局跌落时恢复', () => {
    const safe = getSafeSpawnPosition();
    const nearby = [safe[0] + 1, safe[1], safe[2]] as const;
    expect(isPlayerPositionSafe(nearby)).toBe(true);
    expect(resolvePlayerBoundaryPosition(nearby, safe)).toEqual(nearby);

    const high = [safe[0], safe[1] + 20, safe[2]] as const;
    expect(isPlayerPositionSafe(high)).toBe(true);
    expect(resolvePlayerBoundaryPosition(high, safe)).toEqual(high);

    const sea = [islandTerrainConfig.islandRadiusX * 1.2, high[1], high[2]] as const;
    expect(isPlayerPositionSafe(sea)).toBe(false);
    expect(resolvePlayerBoundaryPosition(sea, safe)).toEqual(safe);

    const fallen = [safe[0], -1, safe[2]] as const;
    expect(isPlayerPositionSafe(fallen)).toBe(false);
    expect(resolvePlayerBoundaryPosition(fallen, safe)).toEqual(safe);
  });
});
