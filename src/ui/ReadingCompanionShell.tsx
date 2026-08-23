import type { RefObject } from 'react';
import type { SceneDiagnostics } from '../scene/createIslandScene';

interface ReadingCompanionShellProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  sceneError: string | null;
  diagnostics: SceneDiagnostics | null;
  buildId: string;
}

export function ReadingCompanionShell({ canvasRef, sceneError, diagnostics, buildId }: ReadingCompanionShellProps) {
  return (
    <main className="reading-companion" aria-label="Lincoln Island 漫游测试界面">
      <div className="world-view">
        <canvas ref={canvasRef} aria-label="3D 世界画布" tabIndex={0} />
      </div>
      <header className="product-header">
        <p className="eyebrow">LINCOLN ISLAND</p>
        <h1>儿童阅读伴侣：可漫游诊断营地</h1>
        <p className="status">技术诊断 · 灰盒营地</p>
      </header>
      {sceneError ? <p className="scene-error" role="alert">{sceneError}</p> : null}
      <aside className="diagnostic-hud" aria-label="技术诊断 HUD">
        <p className="diagnostic-title">技术诊断 · 灰盒状态</p>
        <p data-testid="build-id">版本 {buildId}</p>
        <p>位置 {diagnostics ? diagnostics.position.map((value) => value.toFixed(1)).join(' / ') : '加载中...'}</p>
        <p>朝向 {diagnostics ? `${diagnostics.heading} · yaw ${diagnostics.yaw.toFixed(2)}` : '加载中...'}</p>
        <p>速度参数 {diagnostics ? `${diagnostics.movementSpeed.toFixed(2)} m/帧基准` : '加载中...'}</p>
        <p>输入 {diagnostics?.keys ?? '加载中...'}</p>
        <p>视角 {diagnostics?.pointerLocked ? '已进入视角' : '未锁定'}</p>
        <p>营地 {sceneError ? `失败：${sceneError}` : diagnostics ? `${diagnostics.camp} · 距营地 ${diagnostics.distanceFromCamp.toFixed(1)}m` : '加载中...'}</p>
        <p>恢复 {diagnostics?.recovery ?? '加载中...'}</p>
        <p>动作 {diagnostics?.motion ?? '加载中...'}</p>
        <p>道具 {diagnostics ? (diagnostics.hasGun ? '已获得枪' : '未获得枪') : '加载中...'}</p>
        <p>武器 {diagnostics ? (diagnostics.hasGun ? `已装备 · 开火 ${diagnostics.shotsFired} 次` : '未装备') : '加载中...'}</p>
        <p>弹药 {diagnostics ? `${diagnostics.ammoInMagazine} / ${diagnostics.reserveAmmo}` : '加载中...'}</p>
        <p>生命 {diagnostics ? `${diagnostics.playerHealth} · 敌人剩余 ${diagnostics.enemiesRemaining}` : '加载中...'}</p>
        <p>渲染 {diagnostics?.references ?? '加载中...'}</p>
        {diagnostics?.sceneStatus?.startsWith('失败：') ? <p>场景 {diagnostics.sceneStatus}</p> : null}
      </aside>
      <span className="reticle" aria-hidden="true">+</span>
      <p className="interaction-hint">点击画面进入视角 · WASD/方向键移动 · 空格跳跃 · 靠近山顶枪支可拾取 · 左键开火 · 抬头左键换弹 · R 返回诊断营地 · Esc 退出鼠标锁定</p>
    </main>
  );
}
